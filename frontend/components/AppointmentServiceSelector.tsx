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
    label: 'General Consultation',
    services: [
      { value: 'consultation', label: 'Consultation' },
      { value: 'general-checkup', label: 'General Checkup' },
      { value: 'vaccination', label: 'Vaccination / Immunization' },
      { value: 'flea-tick-prevention', label: 'Flea & Tick Prevention' },
      { value: 'deworming', label: 'Deworming' },
    ],
  },
  {
    id: 'preventive',
    label: 'Preventive Care',
    services: [
      { value: 'vaccination', label: 'Vaccination / Immunization' },
      { value: 'flea-tick-prevention', label: 'Flea & Tick Prevention' },
      { value: 'deworming', label: 'Deworming' },
    ],
  },
  {
    id: 'surgery',
    label: 'Surgical Procedures',
    services: [
      { value: 'sterilization', label: 'Sterilization' },
    ],
  },
  {
    id: 'grooming',
    label: 'Grooming',
    services: [
      { value: 'basic-grooming', label: 'Basic Grooming' },
      { value: 'full-grooming', label: 'Full Grooming' },
    ],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

function CheckboxOption({
  item,
  selected,
  onToggle,
}: {
  item: ServiceItem
  selected: boolean
  onToggle: (value: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(item.value)}
      className={`w-full px-3 py-2 rounded-lg text-sm text-left flex items-center gap-2.5 transition-colors ${
        selected
          ? 'bg-[#7FA5A3]/10 text-[#5A7C7A]'
          : 'text-[#4F4F4F] hover:bg-gray-100'
      }`}
    >
      {/* Checkbox */}
      <span
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          selected ? 'border-[#5A7C7A] bg-[#7FA5A3]' : 'border-gray-300'
        }`}
      >
        {selected && <Check className="w-3 h-3 text-white" />}
      </span>
      {item.label}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface AppointmentServiceSelectorProps {
  /** Currently selected service values (multiple selection). */
  values: string[]
  /** Called when the user toggles a service. */
  onChange: (values: string[]) => void
  /** Optional dynamic categories from database. Falls back to defaults if not provided. */
  categories?: ServiceCategory[]
}

export default function AppointmentServiceSelector({
  values,
  onChange,
  categories,
}: AppointmentServiceSelectorProps) {
  // "general" is expanded by default as it's the most common booking.
  const [openCategory, setOpenCategory] = useState<string>('general')

  const toggleCategory = (id: string) => {
    setOpenCategory((prev) => (prev === id ? '' : id))
  }

  // Use provided categories or fall back to defaults
  const displayCategories = categories || SERVICE_CATEGORIES

  const GROOMING_OPTIONS = ['basic-grooming', 'full-grooming']

  // Toggle a service value
  const toggleService = (serviceValue: string) => {
    const isGroomingOption = GROOMING_OPTIONS.includes(serviceValue)

    if (values.includes(serviceValue)) {
      // Deselecting — always allowed
      onChange(values.filter((v) => v !== serviceValue))
    } else {
      if (isGroomingOption) {
        // Selecting grooming: clear ALL medical services, keep only this grooming option
        onChange([serviceValue])
      } else {
        // Selecting medical: clear ALL grooming services, add this medical service
        onChange([...values.filter((v) => !GROOMING_OPTIONS.includes(v)), serviceValue])
      }
    }
  }

  // Determine which categories have selections
  const findCategoriesForValues = (vals: string[]): Set<string> => {
    const categories = new Set<string>()
    for (const cat of SERVICE_CATEGORIES) {
      if (cat.services?.some((s) => vals.includes(s.value))) categories.add(cat.id)
      if (cat.subGroups?.some((sg) => sg.services.some((s) => vals.includes(s.value)))) categories.add(cat.id)
    }
    return categories
  }

  const selectedCategories = findCategoriesForValues(values)

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
      {displayCategories.map((cat) => {
        const isOpen = openCategory === cat.id
        const hasSelection = selectedCategories.has(cat.id)

        // Collect all services for rendering
        const allServices: ServiceItem[] = cat.services
          ? cat.services
          : cat.subGroups?.flatMap((sg) => sg.services) ?? []

        // Count selected services in this category
        const selectedCount = allServices.filter((s) => values.includes(s.value)).length

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
                    {selectedCount} selected
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
                        <CheckboxOption
                          key={item.value}
                          item={item}
                          selected={values.includes(item.value)}
                          onToggle={toggleService}
                        />
                      ))}
                    </div>
                  ))
                ) : (
                  // Flat service list
                  cat.services?.map((item) => (
                    <CheckboxOption
                      key={item.value}
                      item={item}
                      selected={values.includes(item.value)}
                      onToggle={toggleService}
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
