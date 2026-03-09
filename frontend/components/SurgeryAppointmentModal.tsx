'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getSurgeryServices, type ProductService } from '@/lib/medicalRecords'
import { getAvailableSlots, createAppointment, getClinicBranches, getAssignedVets, type ClinicBranch, type AssignedVet } from '@/lib/appointments'
import { toast } from 'sonner'
import { Clock, AlertCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

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

      if (res.status === 'SUCCESS') {
        toast.success('Surgery appointment scheduled successfully')
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

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">✓</span>
            </div>
            <div>
              <DialogTitle className="text-2xl">Schedule Surgery</DialogTitle>
              <DialogDescription>Set up a surgical appointment for {petName}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-6 py-6">
          {/* Left side: Form fields */}
          <div className="flex-1 space-y-6">
            {/* Surgery Services */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Surgery Type <span className="text-red-500">*</span>
              </label>
              <div className="border border-gray-200 rounded-xl p-3 space-y-2 max-h-48 overflow-y-auto">
                {surgeryServices.length === 0 ? (
                  <p className="text-sm text-gray-500">No surgery services available</p>
                ) : (
                  surgeryServices.map((service) => (
                    <label key={service._id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedServices.includes(service._id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedServices([...selectedServices, service._id])
                          } else {
                            setSelectedServices(selectedServices.filter((id) => id !== service._id))
                          }
                        }}
                        className="w-4 h-4 accent-[#476B6B]"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">{service.name}</p>
                        {service.price && <p className="text-xs text-gray-500">₱{service.price}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Mode of Appointment */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Mode of Appointment</label>
              <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 text-gray-700 font-medium">
                Face to Face
              </div>
            </div>

            {/* Vet Clinic Branch */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">Vet Clinic Branch</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
              >
                <option value="">Select a branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Chosen Veterinarian */}
            {selectedBranchId ? (
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Chosen Veterinarian <span className="text-red-500">*</span>
                </label>
                {loadingVets ? (
                  <div className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 flex items-center justify-center gap-2 text-gray-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading vets...</span>
                  </div>
                ) : (
                  <select
                    value={selectedVetId}
                    onChange={(e) => setSelectedVetId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] bg-white"
                  >
                    <option value="">Select a veterinarian</option>
                    {vets.map((vet) => (
                      <option key={vet._id} value={vet._id}>
                        {vet.firstName} {vet.lastName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">Please select a branch first to see available veterinarians</p>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  setSelectedSlot(null)
                }}
                min={minDate}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
            </div>
          </div>

          {/* Right side: Time slots */}
          <div className="w-56">
            <div className="sticky top-0">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-800">Available Times</h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ) : date && selectedVetId ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {timeSlots.length === 0 ? (
                    <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0" />
                      <p className="text-xs text-yellow-700">No slots available on this date</p>
                    </div>
                  ) : (
                    timeSlots.map((slot, idx) => {
                      const isAvailable = slot.status === 'available'
                      const isYourBooking = slot.status === 'your-booking'
                      const isSelected =
                        selectedSlot?.startTime === slot.startTime && selectedSlot?.endTime === slot.endTime

                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (isAvailable) {
                              setSelectedSlot({ startTime: slot.startTime, endTime: slot.endTime })
                            }
                          }}
                          disabled={!isAvailable}
                          className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-[#476B6B] text-white border-2 border-[#476B6B]'
                              : isAvailable
                              ? 'bg-white border-2 border-gray-200 text-gray-700 hover:border-[#7FA5A3]'
                              : isYourBooking
                              ? 'bg-[#7FA5A3]/10 border-2 border-[#7FA5A3] text-[#476B6B]'
                              : 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {slot.startTime} - {slot.endTime}
                        </button>
                      )
                    })
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-500 py-6 text-center">Select date and vet to see available times</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="px-6 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedServices.length || !date || !selectedVetId || !selectedSlot}
            className="flex items-center gap-2 px-6 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Set an appointment
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
