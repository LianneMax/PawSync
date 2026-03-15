'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  listVetReports,
  formatReportDate,
  type VetReport,
} from '@/lib/vetReports'
import {
  FileText,
  Plus,
  Search,
  Share2,
  Clock,
  CheckCircle2,
  PawPrint,
} from 'lucide-react'
import { toast } from 'sonner'

function StatusBadge({ status, shared }: { status: string; shared: boolean }) {
  if (shared)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <Share2 className="w-3 h-3" /> Shared
      </span>
    )
  if (status === 'finalized')
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <CheckCircle2 className="w-3 h-3" /> Finalized
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
      <Clock className="w-3 h-3" /> Draft
    </span>
  )
}

export default function VetReportsPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const [reports, setReports] = useState<VetReport[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listVetReports({}, token || undefined)
      setReports(result.data)
      setTotal(result.total)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase()
    if (!q) return true
    return (
      r.title.toLowerCase().includes(q) ||
      r.petId?.name?.toLowerCase().includes(q)
    )
  })

  return (
    <DashboardLayout userType={user?.userType as any}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vet Reports</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create and manage diagnostic reports for your patients
            </p>
          </div>
          <button
            onClick={() => router.push('/vet-dashboard/reports/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient name or report title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <FileText className="w-12 h-12 opacity-30" />
            <p className="text-sm">No reports yet. Create one to get started.</p>
            <button
              onClick={() => router.push('/vet-dashboard/reports/new')}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-sm hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Report
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <button
                key={r._id}
                onClick={() => router.push(`/vet-dashboard/reports/${r._id}`)}
                className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                      <PawPrint className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 truncate">
                        {r.title || `Report — ${r.petId?.name}`}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {r.petId?.name} &middot; {r.petId?.species === 'canine' ? 'Canine' : 'Feline'} / {r.petId?.breed}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <StatusBadge status={r.status} shared={r.sharedWithOwner} />
                    <span className="text-xs text-gray-400">{formatReportDate(r.reportDate)}</span>
                  </div>
                </div>
                {r.isAIGenerated && (
                  <p className="mt-2 text-xs text-indigo-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                    AI-generated
                  </p>
                )}
              </button>
            ))}
          </div>
        )}

        {!loading && total > filtered.length && (
          <p className="text-center text-xs text-gray-400 mt-4">
            Showing {filtered.length} of {total} reports
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
