'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { createMedicalRecord, getSurgeryServices, type ProductService } from '@/lib/medicalRecords'
import { uploadImage } from '@/lib/upload'
import { toast } from 'sonner'
import { Upload, X, Check, Loader2, ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SurgeryMedicalRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appointmentId: string
  petId: string
  petName: string
  onSaved?: () => void
}

interface SurgeryImage {
  type: 'before' | 'during' | 'after'
  file: File | null
  preview: string | null
}

export default function SurgeryMedicalRecordModal({
  open,
  onOpenChange,
  appointmentId,
  petId,
  petName,
  onSaved,
}: SurgeryMedicalRecordModalProps) {
  const token = useAuthStore((s) => s.token)
  const [surgeryServices, setSurgeryServices] = useState<ProductService[]>([])
  const [selectedSurgeryId, setSelectedSurgeryId] = useState('')
  const [vetRemarks, setVetRemarks] = useState('')
  const [images, setImages] = useState<SurgeryImage[]>([
    { type: 'before', file: null, preview: null },
    { type: 'during', file: null, preview: null },
    { type: 'after', file: null, preview: null },
  ])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Fetch surgery services on mount
  useEffect(() => {
    if (!open || !token) return
    const loadServices = async () => {
      setLoading(true)
      try {
        const res = await getSurgeryServices(token as string)
        if (res.status === 'SUCCESS' && res.data?.items) {
          // Filter to only Sterilization
          const filtered = res.data.items.filter((item) => item.name === 'Sterilization')
          setSurgeryServices(filtered)
          if (filtered.length > 0) {
            setSelectedSurgeryId(filtered[0]._id)
          }
        }
      } catch {
        toast.error('Failed to load surgery services')
      } finally {
        setLoading(false)
      }
    }
    loadServices()
  }, [open, token])

  const handleImageSelect = (type: 'before' | 'during' | 'after', file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    uploadImage(file, 'medical-records').then((url) => {
      setImages((prev) =>
        prev.map((img) =>
          img.type === type
            ? { ...img, file, preview: url }
            : img
        )
      )
    }).catch(console.error)
  }

  const removeImage = (type: 'before' | 'during' | 'after') => {
    setImages((prev) =>
      prev.map((img) =>
        img.type === type
          ? { type, file: null, preview: null }
          : img
      )
    )
  }

  const handleSubmit = async () => {
    if (!selectedSurgeryId) {
      toast.error('Please select a surgery type')
      return
    }

    const selectedSurgery = surgeryServices.find((s) => s._id === selectedSurgeryId)
    if (!selectedSurgery) {
      toast.error('Invalid surgery selection')
      return
    }

    setSubmitting(true)
    try {
      const imageData: { url: string; description: string }[] = []
      for (const img of images) {
        if (img.preview) {
          imageData.push({ url: img.preview, description: `${img.type} surgery image` })
        }
      }

      const res = await createMedicalRecord(
        {
          petId,
          appointmentId,
          vetNotes: vetRemarks,
          visitSummary: `Surgical procedure: ${selectedSurgery.name}`,
          overallObservation: `Pre-operative assessment for ${selectedSurgery.name}`,
          images: imageData,
          sharedWithOwner: false,
        },
        token as string
      )

      if (res.status === 'SUCCESS') {
        toast.success('Surgery medical record created successfully')
        onOpenChange(false)
        onSaved?.()
        // Reset form
        setSelectedSurgeryId(surgeryServices[0]?._id || '')
        setVetRemarks('')
        setImages([
          { type: 'before', file: null, preview: null },
          { type: 'during', file: null, preview: null },
          { type: 'after', file: null, preview: null },
        ])
      } else {
        toast.error(res.message || 'Failed to create medical record')
      }
    } catch (error) {
      toast.error('An error occurred while creating the medical record')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedSurgery = surgeryServices.find((s) => s._id === selectedSurgeryId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden rounded-2xl flex flex-col [&>button]:hidden">
        <DialogHeader className="px-8 py-6 border-b border-gray-200">
          <DialogTitle className="text-2xl text-[#2C3E2D]">
            Record Surgery — {petName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="space-y-6">
            {/* Surgery Type */}
            <div>
              <label className="text-sm font-semibold text-[#2C3E2D] mb-2 block">
                Surgery Type <span className="text-red-500">*</span>
              </label>
              {loading ? (
                <div className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 text-sm text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading surgeries...
                </div>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white text-sm text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] transition-colors flex items-center justify-between"
                    >
                      <span>
                        {selectedSurgery?.name || 'Select a surgery...'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) max-h-56 overflow-y-auto rounded-xl">
                    <DropdownMenuRadioGroup value={selectedSurgeryId} onValueChange={setSelectedSurgeryId}>
                      <DropdownMenuRadioItem value="">Select a surgery...</DropdownMenuRadioItem>
                      {surgeryServices.map((surgery) => (
                        <DropdownMenuRadioItem key={surgery._id} value={surgery._id}>
                          {surgery.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {selectedSurgery && (
                <p className="text-xs text-gray-500 mt-1">
                  ₱{selectedSurgery.price}
                </p>
              )}
            </div>

            {/* Surgery Images */}
            <div>
              <label className="text-sm font-semibold text-[#2C3E2D] mb-3 block">
                Surgery Images
              </label>
              <div className="grid grid-cols-3 gap-4">
                {images.map((img) => (
                  <div key={img.type} className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-gray-600 capitalize">
                      {img.type} Surgery
                    </p>
                    {img.preview ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-[#7FA5A3] bg-gray-50">
                        <img
                          src={img.preview}
                          alt={`${img.type} surgery`}
                          className="w-full h-32 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(img.type)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-green-500 text-white px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Uploaded
                        </div>
                      </div>
                    ) : (
                      <label className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#7FA5A3] bg-gray-50 hover:bg-[#7FA5A3]/5 transition-colors flex flex-col items-center justify-center cursor-pointer gap-2">
                        <Upload className="w-5 h-5 text-gray-400" />
                        <span className="text-xs text-gray-500">Upload image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageSelect(img.type, file)
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Vet Remarks */}
            <div>
              <label className="text-sm font-semibold text-[#2C3E2D] mb-2 block">
                Vet Remarks
              </label>
              <textarea
                value={vetRemarks}
                onChange={(e) => setVetRemarks(e.target.value)}
                placeholder="Enter any notes about the surgery, observations, or post-operative care instructions..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-[#4F4F4F] placeholder-gray-400 focus:outline-none focus:border-[#7FA5A3] transition-colors resize-none"
                rows={5}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-gray-200 px-8 py-4 flex gap-2 justify-center">
          <button
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="px-8 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedSurgeryId}
            className="flex items-center gap-2 px-8 py-2.5 bg-[#5A7C7A] text-white rounded-full text-sm font-medium hover:bg-[#4a6a6a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Surgery Record
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
