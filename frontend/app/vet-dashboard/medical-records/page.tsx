'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, type MedicalRecord } from '@/lib/medicalRecords'
import {
  FileText,
  Plus,
  PawPrint,
  Clock,
  Eye,
  Share2,
  ChevronRight,
} from 'lucide-react'

export default function VetMedicalRecordsPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchRecords = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await getVetMedicalRecords({ limit: 50 }, token)
      if (res.status === 'SUCCESS' && res.data) {
        setRecords(res.data.records)
        setTotal(res.data.total)
      }
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function getPetName(record: MedicalRecord) {
    if (typeof record.petId === 'object' && record.petId?.name) return record.petId.name
    return '—'
  }

  function getPetSpecies(record: MedicalRecord) {
    if (typeof record.petId === 'object' && record.petId?.species) return record.petId.species
    return ''
  }

  function hasVitals(record: MedicalRecord) {
    const v = record.vitals
    return Object.values(v).some((e) => e.value !== '' && e.value !== null && e.value !== undefined)
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">Medical Records</h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} record{total !== 1 ? 's' : ''} found
            </p>
          </div>
          <button
            onClick={() => router.push('/vet-dashboard/medical-records/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Record
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-4">No medical records yet</p>
            <button
              onClick={() => router.push('/vet-dashboard/medical-records/new')}
              className="px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
            >
              Create First Record
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div
                key={rec._id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-[#7FA5A3] transition-colors cursor-pointer"
                onClick={() => router.push(`/vet-dashboard/medical-records/new?edit=${rec._id}`)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Pet info */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#f0f7f7] rounded-xl flex items-center justify-center shrink-0">
                      <PawPrint className="w-5 h-5 text-[#476B6B]" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#4F4F4F]">{getPetName(rec)}</p>
                      <p className="text-xs text-gray-500 capitalize">{getPetSpecies(rec)}</p>
                    </div>
                  </div>

                  {/* Middle: summary or vitals indicator */}
                  <div className="flex-1 min-w-0 px-4">
                    {rec.visitSummary ? (
                      <p className="text-sm text-gray-700 truncate">{rec.visitSummary}</p>
                    ) : rec.overallObservation ? (
                      <p className="text-sm text-gray-500 italic truncate">{rec.overallObservation}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No summary</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          rec.isCurrent
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        }`}
                      >
                        {rec.isCurrent ? 'Current' : 'Historical'}
                      </span>
                      {rec.sharedWithOwner && (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <Share2 className="w-3 h-3" />
                          Shared
                        </span>
                      )}
                      {!hasVitals(rec) && (
                        <span className="text-xs text-orange-500">No vitals recorded</span>
                      )}
                    </div>
                  </div>

                  {/* Date + chevron */}
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-400 justify-end mb-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(rec.createdAt)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
