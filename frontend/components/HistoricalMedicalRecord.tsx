'use client'

import { useState } from 'react'
import { useHistoricalMedicalRecord } from '@/hooks/useHistoricalMedicalRecord'
import {
  Heart,
  Pill,
  Syringe,
  Scissors,
  Baby,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'

interface HistoricalMedicalRecordProps {
  petId: string | null
  token: string | null
  refreshTrigger?: number
  isReadOnly?: boolean
}

export function HistoricalMedicalRecord({
  petId,
  token,
  refreshTrigger = 0,
  isReadOnly = false,
}: HistoricalMedicalRecordProps) {
  const { data, loading, error } = useHistoricalMedicalRecord(petId, token, refreshTrigger)
  const [expandedSections, setExpandedSections] = useState({
    petInfo: true,
    operations: true,
    medications: true,
    chiefComplaint: true,
    soap: true,
    vaccinations: true,
    pregnancy: false,
  })

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading medical history...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-400">
        No medical history available
      </div>
    )
  }

  const pet = data.pet
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--
    return age
  }

  return (
    <div className="space-y-4">
      {/* ─── PET INFORMATION ─── */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
        <button
          onClick={() => toggleSection('petInfo')}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#476B6B]" />
            <h3 className="font-semibold text-[#4F4F4F]">Patient Information</h3>
          </div>
          {expandedSections.petInfo ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {expandedSections.petInfo && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Name</p>
                <p className="text-[#4F4F4F] font-semibold">{pet.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Species</p>
                <p className="text-[#4F4F4F] font-semibold capitalize">{pet.species}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Age</p>
                <p className="text-[#4F4F4F] font-semibold">{pet.age}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Breed</p>
                <p className="text-[#4F4F4F] font-semibold">{pet.breed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sex</p>
                <p className="text-[#4F4F4F] font-semibold capitalize">{pet.sex}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Weight</p>
                <p className="text-[#4F4F4F] font-semibold">{pet.weight} kg</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sterilization</p>
                <p className="text-[#4F4F4F] font-semibold capitalize">{pet.sterilization}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Color</p>
                <p className="text-[#4F4F4F] font-semibold">{pet.color || 'N/A'}</p>
              </div>
              {pet.microchipNumber && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Microchip</p>
                  <p className="text-[#4F4F4F] font-semibold text-xs">{pet.microchipNumber}</p>
                </div>
              )}
            </div>
            {pet.allergies && pet.allergies.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {pet.allergies.map((allergy, i) => (
                    <div key={i} className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                      {allergy}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── WHY HERE TODAY ─── */}
      {data.chiefComplaint && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-blue-50/30">
          <button
            onClick={() => toggleSection('chiefComplaint')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-200"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-[#4F4F4F]">Why Patient is Here Today</h3>
            </div>
            {expandedSections.chiefComplaint ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.chiefComplaint && (
            <div className="px-4 py-3">
              <p className="text-sm text-[#4F4F4F] leading-relaxed whitespace-pre-wrap">
                {data.chiefComplaint}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── OPERATIONS ─── */}
      {data.operations.length > 0 && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-blue-50/30">
          <button
            onClick={() => toggleSection('operations')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-200"
          >
            <div className="flex items-center gap-2">
              <Scissors className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-[#4F4F4F]">
                Operations ({data.operations.length})
              </h3>
            </div>
            {expandedSections.operations ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.operations && (
            <div className="px-4 py-3 space-y-3 border-t border-blue-200">
              {data.operations.map((op, i) => (
                <div key={i} className="pb-3 last:pb-0 last:border-b-0 border-b border-blue-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-blue-900">{op.surgeryType}</p>
                    <span className="text-xs text-blue-600 font-medium">{formatDate(op.date)}</span>
                  </div>
                  {op.vetRemarks && (
                    <p className="text-sm text-gray-600 mt-1">{op.vetRemarks}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── MEDICATIONS ─── */}
      {data.medications.length > 0 && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-blue-50/30">
          <button
            onClick={() => toggleSection('medications')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-200"
          >
            <div className="flex items-center gap-2">
              <Pill className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-[#4F4F4F]">
                Medications ({data.medications.length})
              </h3>
            </div>
            {expandedSections.medications ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.medications && (
            <div className="px-4 py-3 space-y-3 border-t border-blue-200">
              {data.medications.map((med, i) => (
                <div key={i} className="pb-3 last:pb-0 last:border-b-0 border-b border-blue-100">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-blue-900">{med.name}</p>
                    <div
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        med.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : med.status === 'completed'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {med.status}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {med.dosage} · {med.route} · {med.frequency}
                  </p>
                  {(med.startDate || med.endDate) && (
                    <p className="text-xs text-gray-500 mt-1">
                      {med.startDate ? formatDate(med.startDate) : 'N/A'} to{' '}
                      {med.endDate ? formatDate(med.endDate) : 'ongoing'}
                    </p>
                  )}
                  {med.notes && <p className="text-xs text-gray-600 mt-1 italic">{med.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── LATEST SOAP NOTES ─── */}
      {data.latestSOAP && (
        <div className="border border-blue-200 rounded-2xl overflow-hidden bg-blue-50/30">
          <button
            onClick={() => toggleSection('soap')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-blue-200"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-[#4F4F4F]">Most Recent SOAP Notes</h3>
            </div>
            {expandedSections.soap ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.soap && (
            <div className="px-4 py-3 space-y-3 border-t border-blue-200">
              <div>
                <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Date</p>
                <p className="text-sm text-gray-600">{formatDate(data.latestSOAP.date)}</p>
              </div>
              {data.latestSOAP.subjective && (
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Subjective (S)</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.latestSOAP.subjective}</p>
                </div>
              )}
              {data.latestSOAP.objective && (
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Objective (O)</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.latestSOAP.objective}</p>
                </div>
              )}
              {data.latestSOAP.assessment && (
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Assessment (A)</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.latestSOAP.assessment}</p>
                </div>
              )}
              {data.latestSOAP.plan && (
                <div>
                  <p className="text-xs font-semibold text-blue-900 uppercase tracking-wide">Plan (P)</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{data.latestSOAP.plan}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── VACCINATIONS ─── */}
      {data.vaccinations.length > 0 && (
        <div className="border border-green-200 rounded-2xl overflow-hidden bg-green-50/30">
          <button
            onClick={() => toggleSection('vaccinations')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 transition-colors border-b border-green-200"
          >
            <div className="flex items-center gap-2">
              <Syringe className="w-4 h-4 text-green-600" />
              <h3 className="font-semibold text-[#4F4F4F]">
                Vaccinations ({data.vaccinations.length})
              </h3>
            </div>
            {expandedSections.vaccinations ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.vaccinations && (
            <div className="px-4 py-3 border-t border-green-200">
              <div className="space-y-3">
                {data.vaccinations.map((vac, i) => (
                  <div key={i} className="pb-3 last:pb-0 last:border-b-0 border-b border-green-100">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-green-900">{vac.name}</p>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          vac.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {vac.status}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                      <p>Administered: {formatDate(vac.dateAdministered)}</p>
                      {vac.nextDueDate && (
                        <p>Next Due: {formatDate(vac.nextDueDate)}</p>
                      )}
                      <p>Route: {vac.route} · {vac.manufacturer}</p>
                      {vac.batchNumber && <p>Batch: {vac.batchNumber}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PREGNANCY RECORDS (only for females) ─── */}
      {pet.sex === 'female' && data.pregnancyRecords.length > 0 && (
        <div className="border border-green-200 rounded-2xl overflow-hidden bg-green-50/30">
          <button
            onClick={() => toggleSection('pregnancy')}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-green-50 transition-colors border-b border-green-200"
          >
            <div className="flex items-center gap-2">
              <Baby className="w-4 h-4 text-green-600" />
              <h3 className="font-semibold text-[#4F4F4F]">
                Pregnancy Records ({data.pregnancyRecords.length})
              </h3>
            </div>
            {expandedSections.pregnancy ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.pregnancy && (
            <div className="px-4 py-3 space-y-3 border-t border-green-200">
              {data.pregnancyRecords.map((preg, i) => (
                <div key={i} className="pb-3 last:pb-0 last:border-b-0 border-b border-green-100">
                  <p className="text-xs font-semibold text-green-900 uppercase tracking-wide mb-2">
                    {formatDate(preg.date || '')}
                  </p>
                  {preg.isPregnant !== undefined && (
                    <p className="text-sm text-gray-600">
                      Pregnant: <span className="font-semibold">{preg.isPregnant ? 'Yes' : 'No'}</span>
                    </p>
                  )}
                  {preg.gestationDate && (
                    <p className="text-sm text-gray-600">
                      Gestation Date: <span className="font-semibold">{formatDate(preg.gestationDate)}</span>
                    </p>
                  )}
                  {preg.expectedDueDate && (
                    <p className="text-sm text-gray-600">
                      Expected Due: <span className="font-semibold">{formatDate(preg.expectedDueDate)}</span>
                    </p>
                  )}
                  {preg.litterNumber !== undefined && preg.litterNumber !== null && (
                    <p className="text-sm text-gray-600">
                      Litter #: <span className="font-semibold">{preg.litterNumber}</span>
                    </p>
                  )}
                  {preg.deliveryDate && (
                    <p className="text-sm text-gray-600">
                      Delivery Date: <span className="font-semibold">{formatDate(preg.deliveryDate)}</span>
                    </p>
                  )}
                  {preg.deliveryType && (
                    <p className="text-sm text-gray-600">
                      Delivery Type: <span className="font-semibold capitalize">{preg.deliveryType}</span>
                    </p>
                  )}
                  {preg.motherCondition && (
                    <p className="text-sm text-gray-600">
                      Mother Condition: <span className="font-semibold capitalize">{preg.motherCondition}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
