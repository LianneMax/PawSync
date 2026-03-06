'use client'

import { useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// ── Data model ────────────────────────────────────────────────────────────────

interface ServiceItem {
  value: string
  label: string
}

interface ServiceSubGroup {
  label: string
  services: ServiceItem[]
}

interface ServiceCategory {
  id: string
  label: string
  /** Flat list of services (most categories). */
  services?: ServiceItem[]
  /** Nested sub-groups (e.g. Diagnostic Services → Lab Tests / Imaging). */
  subGroups?: ServiceSubGroup[]
  /** Optional footnote rendered below the category panel. */
  note?: string
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    id: 'general',
    label: 'General Consultation & Preventive Care',
    services: [
      { value: 'consultation', label: 'Consultation' },
      { value: 'general-checkup', label: 'General Checkup' },
      { value: 'primary-treatment', label: 'Primary Treatment' },
      { value: 'vaccination', label: 'Vaccination / Immunization' },
      { value: 'puppy-litter-vaccination', label: 'Puppy Litter Vaccination' },
      { value: 'deworming', label: 'Deworming' },
    ],
  },
  {
    id: 'diagnostic',
    label: 'Diagnostic Services',
    subGroups: [
      {
        label: 'Laboratory Tests',
        services: [
          { value: 'cbc', label: 'CBC (Complete Blood Count)' },
          { value: 'blood-chemistry-16', label: 'Blood Chemistry – 16 Panel' },
          { value: 'pcr-test', label: 'PCR Test' },
        ],
      },
      {
        label: 'Imaging',
        services: [
          { value: 'x-ray', label: 'X-ray' },
          { value: 'ultrasound', label: 'Ultrasound (Preliminary AFAST)' },
        ],
      },
    ],
  },
  {
    id: 'surgery',
    label: 'Surgery & Advanced Procedures',
    services: [
      { value: 'abdominal-surgery', label: 'Abdominal Surgery' },
      { value: 'orthopedic-surgery', label: 'Orthopedic Surgery' },
      { value: 'dental-scaling', label: 'Dental Scaling' },
      { value: 'laser-therapy', label: 'Laser Therapy' },
    ],
  },
  {
    id: 'medical-care',
    label: 'Medical Care & Monitoring',
    services: [
      { value: 'inpatient-care', label: 'Inpatient Care / Confinement' },
      { value: 'outpatient-treatment', label: 'Outpatient Treatment' },
      { value: 'point-of-care-diagnostic', label: 'Point-of-Care Diagnostic Procedures' },
    ],
  },
  {
    id: 'grooming',
    label: 'Grooming',
    services: [
      { value: 'basic-grooming', label: 'Basic Grooming' },
      { value: 'full-grooming', label: 'Full Grooming' },
    ],
    note: 'Grooming starts at ₱500 and includes a free vet consultation. Grooming is first-come, first-served from 9AM–5PM.',
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function RadioOption({
  item,
  selected,
  onSelect,
}: {
  item: ServiceItem
  selected: boolean
  onSelect: (value: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.value)}
      className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2.5 transition-colors ${
        selected
          ? 'bg-[#7FA5A3]/10 text-[#5A7C7A]'
          : 'text-[#4F4F4F] hover:bg-gray-100'
      }`}
    >
      {/* Radio circle */}
      <span
        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'border-[#5A7C7A]' : 'border-gray-300'
        }`}
      >
        {selected && <span className="w-2 h-2 rounded-full bg-[#5A7C7A]" />}
      </span>
      {item.label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AppointmentServiceSelectorProps {
  /** Currently selected service value (single selection). */
  value: string
  /** Called when the user picks a service. */
  onChange: (value: string) => void
}

export default function AppointmentServiceSelector({
  value,
  onChange,
}: AppointmentServiceSelectorProps) {
  // "general" is expanded by default as it's the most common booking.
  const [openCategory, setOpenCategory] = useState<string>('general')

  const toggleCategory = (id: string) => {
    setOpenCategory((prev) => (prev === id ? '' : id))
  }

  // Determine which category contains the currently selected value
  const findCategoryForValue = (val: string): string => {
    for (const cat of SERVICE_CATEGORIES) {
      if (cat.services?.some((s) => s.value === val)) return cat.id
      if (cat.subGroups?.some((sg) => sg.services.some((s) => s.value === val))) return cat.id
    }
    return ''
  }

  const selectedCategory = findCategoryForValue(value)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
      {SERVICE_CATEGORIES.map((cat) => {
        const isOpen = openCategory === cat.id
        const hasSelection = selectedCategory === cat.id

        // Collect all services for rendering
        const allServices: ServiceItem[] = cat.services
          ? cat.services
          : cat.subGroups?.flatMap((sg) => sg.services) ?? []

        return (
          <div key={cat.id}>
            {/* Accordion header */}
            <button
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isOpen ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[#2C3E2D]">{cat.label}</span>
                {hasSelection && !isOpen && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-[#5A7C7A] bg-[#7FA5A3]/15 px-2 py-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5" />
                    {allServices.find((s) => s.value === value)?.label}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Accordion body — CSS max-height transition for smooth animation */}
            <div
              className={`overflow-hidden transition-all duration-200 ease-in-out ${
                isOpen ? 'max-h-96' : 'max-h-0'
              }`}
            >
              <div className="px-3 pb-3 pt-1 bg-white space-y-1">
                {cat.subGroups ? (
                  // Nested sub-groups (Diagnostic Services)
                  cat.subGroups.map((sg) => (
                    <div key={sg.label} className="mb-2">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-3 py-1">
                        {sg.label}
                      </p>
                      {sg.services.map((item) => (
                        <RadioOption
                          key={item.value}
                          item={item}
                          selected={value === item.value}
                          onSelect={onChange}
                        />
                      ))}
                    </div>
                  ))
                ) : (
                  // Flat service list
                  cat.services?.map((item) => (
                    <RadioOption
                      key={item.value}
                      item={item}
                      selected={value === item.value}
                      onSelect={onChange}
                    />
                  ))
                )}

                {cat.note && (
                  <p className="mt-2 px-3 py-2 text-[11px] text-[#5A7C7A] bg-[#7FA5A3]/8 rounded-lg leading-relaxed">
                    {cat.note}
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
