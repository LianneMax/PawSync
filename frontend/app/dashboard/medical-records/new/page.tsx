'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getMyPets, type Pet } from '@/lib/pets'
import { createMedicalRecord, type Vitals } from '@/lib/medicalRecords'
import {
  ArrowLeft,
  Save,
  Upload,
  X,
  Stethoscope,
  ImagePlus,
  FileText,
  ChevronDown,
  PawPrint,
} from 'lucide-react'
import { toast } from 'sonner'

// ---- Types ----
interface VitalRow {
  key: keyof Vitals
  label: string
  type: 'number' | 'yesno'
  unit?: string
  placeholder?: string
}

interface ImageUpload {
  id: string
  file: File
  preview: string
  description: string
}

// ---- Vitals config ----
const vitalRows: VitalRow[] = [
  { key: 'weight', label: 'Weight', type: 'number', unit: 'kg', placeholder: '0.00' },
  { key: 'temperature', label: 'Temperature', type: 'number', unit: '°C', placeholder: '38.5' },
  { key: 'pulseRate', label: 'Pulse Rate', type: 'number', unit: 'bpm', placeholder: '80' },
  { key: 'spo2', label: 'SpO2', type: 'number', unit: '%', placeholder: '98' },
  { key: 'bodyConditionScore', label: 'Body Condition Score', type: 'number', unit: '/9', placeholder: '5' },
  { key: 'dentalScore', label: 'Dental Score', type: 'number', unit: '/4', placeholder: '1' },
  { key: 'crt', label: 'CRT', type: 'number', unit: 'sec', placeholder: '2' },
  { key: 'pregnancy', label: 'Pregnancy', type: 'yesno' },
  { key: 'xray', label: 'X-Ray', type: 'yesno' },
  { key: 'vaccinated', label: 'Vaccinated', type: 'yesno' },
]

function buildEmptyVitals(): Record<string, { value: string; notes: string }> {
  const v: Record<string, { value: string; notes: string }> = {}
  vitalRows.forEach((r) => {
    v[r.key] = { value: r.type === 'yesno' ? 'no' : '', notes: '' }
  })
  return v
}

export default function NewMedicalRecordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedPetId = searchParams.get('petId')
  const { token } = useAuthStore()

  // Pet selection
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string>(preselectedPetId || '')
  const [petDropdownOpen, setPetDropdownOpen] = useState(false)
  const [loadingPets, setLoadingPets] = useState(true)

  // Clinic info (in real app, fetched from vet's assignment)
  const [clinicId] = useState(searchParams.get('clinicId') || '')
  const [clinicBranchId] = useState(searchParams.get('branchId') || '')

  // Vitals
  const [vitals, setVitals] = useState(buildEmptyVitals)

  // Images
  const [images, setImages] = useState<ImageUpload[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Overall observation
  const [overallObservation, setOverallObservation] = useState('')

  // Submitting
  const [submitting, setSubmitting] = useState(false)

  // Load pets
  useEffect(() => {
    const loadPets = async () => {
      try {
        const res = await getMyPets(token || undefined)
        if (res.status === 'SUCCESS' && res.data) {
          setPets(res.data.pets)
        }
      } catch {
        // silent
      } finally {
        setLoadingPets(false)
      }
    }
    loadPets()
  }, [token])

  // Vital change handlers
  const handleVitalValue = useCallback((key: string, value: string) => {
    setVitals((prev) => ({ ...prev, [key]: { ...prev[key], value } }))
  }, [])

  const handleVitalNotes = useCallback((key: string, notes: string) => {
    setVitals((prev) => ({ ...prev, [key]: { ...prev[key], notes } }))
  }, [])

  // Image handlers
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        setImages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            preview: reader.result as string,
            description: '',
          },
        ])
      }
      reader.readAsDataURL(file)
    })

    // Reset input so the same file can be re-selected
    e.target.value = ''
  }, [])

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])

  const updateImageDescription = useCallback((id: string, description: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, description } : img)))
  }, [])

  // Submit
  const handleSubmit = async () => {
    if (!selectedPetId) {
      toast.error('Please select a pet')
      return
    }

    // Validate required vitals have values
    for (const row of vitalRows) {
      if (row.type === 'number' && !vitals[row.key].value) {
        toast.error(`Please enter a value for ${row.label}`)
        return
      }
    }

    setSubmitting(true)

    try {
      // Convert vitals to proper types
      const formattedVitals: Vitals = {} as Vitals
      vitalRows.forEach((row) => {
        const entry = vitals[row.key]
        ;(formattedVitals as any)[row.key] = {
          value: row.type === 'number' ? parseFloat(entry.value) || 0 : entry.value,
          notes: entry.notes,
        }
      })

      // Convert images to base64 payloads
      const imagePayloads = await Promise.all(
        images.map(async (img) => {
          const base64 = img.preview.split(',')[1] // strip data:image/...;base64,
          return {
            data: base64,
            contentType: img.file.type,
            description: img.description,
          }
        })
      )

      const res = await createMedicalRecord(
        {
          petId: selectedPetId,
          clinicId,
          clinicBranchId,
          vitals: formattedVitals,
          images: imagePayloads,
          overallObservation,
        },
        token || undefined
      )

      if (res.status === 'SUCCESS' && res.data) {
        toast.success('Medical record saved successfully')
        router.push(`/dashboard/medical-records/${res.data.record._id}`)
      } else {
        toast.error(res.message || 'Failed to save medical record')
      }
    } catch {
      toast.error('An error occurred while saving')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPet = pets.find((p) => p._id === selectedPetId)

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Medical Record</h1>
            <p className="text-sm text-gray-500 mt-0.5">Fill out the examination details below</p>
          </div>
        </div>

        {/* Pet Selection */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PawPrint className="w-5 h-5 text-[#5A7C7A]" />
            <h2 className="text-lg font-semibold text-gray-900">Select Pet</h2>
          </div>

          <div className="relative">
            <button
              onClick={() => setPetDropdownOpen(!petDropdownOpen)}
              className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl bg-white hover:border-[#7FA5A3] transition-colors text-left"
            >
              {loadingPets ? (
                <span className="text-gray-400">Loading pets...</span>
              ) : selectedPet ? (
                <div className="flex items-center gap-3">
                  {selectedPet.photo ? (
                    <img src={selectedPet.photo} alt={selectedPet.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                      <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{selectedPet.name}</p>
                    <p className="text-xs text-gray-500">{selectedPet.breed} &middot; {selectedPet.species}</p>
                  </div>
                </div>
              ) : (
                <span className="text-gray-400">Choose a pet...</span>
              )}
              <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${petDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {petDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 max-h-60 overflow-y-auto">
                {pets.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-400">No pets found</p>
                ) : (
                  pets.map((pet) => (
                    <button
                      key={pet._id}
                      onClick={() => {
                        setSelectedPetId(pet._id)
                        setPetDropdownOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F8F6F2] transition-colors text-left ${
                        pet._id === selectedPetId ? 'bg-[#7FA5A3]/5' : ''
                      }`}
                    >
                      {pet.photo ? (
                        <img src={pet.photo} alt={pet.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center">
                          <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800">{pet.name}</p>
                        <p className="text-xs text-gray-500">{pet.breed} &middot; {pet.species}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vitals Table */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="w-5 h-5 text-[#5A7C7A]" />
            <h2 className="text-lg font-semibold text-gray-900">Examination Vitals</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-[200px]">Parameter</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-[200px]">Value</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Notes</th>
                </tr>
              </thead>
              <tbody>
                {vitalRows.map((row) => (
                  <tr key={row.key} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-gray-800">{row.label}</span>
                      {row.unit && <span className="text-xs text-gray-400 ml-1">({row.unit})</span>}
                    </td>
                    <td className="py-3 px-4">
                      {row.type === 'number' ? (
                        <input
                          type="number"
                          step="any"
                          value={vitals[row.key].value}
                          onChange={(e) => handleVitalValue(row.key, e.target.value)}
                          placeholder={row.placeholder}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7FA5A3] transition-colors"
                        />
                      ) : (
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={row.key}
                              value="yes"
                              checked={vitals[row.key].value === 'yes'}
                              onChange={() => handleVitalValue(row.key, 'yes')}
                              className="w-4 h-4 accent-[#5A7C7A]"
                            />
                            <span className="text-sm text-gray-700">Yes</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={row.key}
                              value="no"
                              checked={vitals[row.key].value === 'no'}
                              onChange={() => handleVitalValue(row.key, 'no')}
                              className="w-4 h-4 accent-[#5A7C7A]"
                            />
                            <span className="text-sm text-gray-700">No</span>
                          </label>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        value={vitals[row.key].notes}
                        onChange={(e) => handleVitalNotes(row.key, e.target.value)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7FA5A3] transition-colors"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Image Uploads */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ImagePlus className="w-5 h-5 text-[#5A7C7A]" />
            <h2 className="text-lg font-semibold text-gray-900">Image Observations</h2>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-8 flex flex-col items-center gap-2 hover:border-[#7FA5A3] hover:bg-[#7FA5A3]/5 transition-colors cursor-pointer"
          >
            <Upload className="w-8 h-8 text-gray-400" />
            <p className="text-sm text-gray-500">Click to upload images</p>
            <p className="text-xs text-gray-400">PNG, JPG, JPEG up to 10MB each</p>
          </button>

          {images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {images.map((img) => (
                <div key={img.id} className="relative border border-gray-200 rounded-xl overflow-hidden">
                  <div className="aspect-video bg-gray-50 relative">
                    <img
                      src={img.preview}
                      alt="Upload preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-3">
                    <input
                      type="text"
                      value={img.description}
                      onChange={(e) => updateImageDescription(img.id, e.target.value)}
                      placeholder="Image description / observation note..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#7FA5A3] transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overall Observation */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#5A7C7A]" />
            <h2 className="text-lg font-semibold text-gray-900">Overall Observation / Additional Notes</h2>
          </div>

          <textarea
            value={overallObservation}
            onChange={(e) => setOverallObservation(e.target.value)}
            placeholder="Enter overall observations, diagnosis, treatment plan, follow-up instructions..."
            rows={6}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#7FA5A3] transition-colors resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mb-10">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-[#5A7C7A] text-white rounded-xl text-sm font-medium hover:bg-[#476B6B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {submitting ? 'Saving...' : 'Save Medical Record'}
          </button>
        </div>
      </div>
    </DashboardLayout>
  )
}
