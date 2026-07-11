'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import {
  listVetReports,
  formatReportDate,
  REPORT_TYPE_CONFIG,
  type VetReport,
  type ReportType,
} from '@/lib/vetReports'
import {
  FileText,
  Plus,
  Search,
  Share2,
  Clock,
  CheckCircle2,
  PawPrint,
  User,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

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

function TypeBadge({ type }: { type?: ReportType }) {
  const label = REPORT_TYPE_CONFIG.find((c) => c.value === type)?.label ?? 'General Report'
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
      {label}
    </span>
  )
}

export default function VetReportsPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const [reports, setReports] = useState<VetReport[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filters — all applied server-side so pagination counts stay correct
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<ReportType>>(new Set())
  const [page, setPage] = useState(1)

  // Debounce the search input; reset to page 1 in the same update so the fetch
  // never runs once with the new filter but a stale page offset
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true)
      const result = await listVetReports(
        {
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          search: debouncedSearch || undefined,
          types: typeFilter.size > 0 ? [...typeFilter] : undefined,
        },
        token || undefined
      )
      setReports(result.data)
      setTotal(result.total)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [token, page, debouncedSearch, typeFilter])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const toggleTypeFilter = (type: ReportType) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = !!debouncedSearch || typeFilter.size > 0

  const ownerName = (r: VetReport): string | null => {
    const owner = r.petId?.ownerId
    if (owner && typeof owner === 'object') return `${owner.firstName} ${owner.lastName}`
    return null
  }

  return (
    <DashboardLayout userType={user?.userType as any}>
      <div className="max-w-5xl mx-auto px-4 pb-8">
        {/* Header, search, and filters stay pinned while the report list scrolls */}
        <div className="sticky top-16 sm:top-0 z-30 bg-[#F8F6F2] -mx-4 px-4 pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <PageHeader
            title="Vet Reports"
            subtitle="Create and manage diagnostic reports for your patients"
            className="mb-0"
          />
          <button
            onClick={() => router.push('/vet-dashboard/reports/new')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by owner, patient name, or report title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Report type filter chips (multi-select) */}
        <div className="flex flex-wrap items-center gap-2 pb-6">
          {REPORT_TYPE_CONFIG.map((cfg) => {
            const active = typeFilter.has(cfg.value)
            return (
              <button
                key={cfg.value}
                onClick={() => toggleTypeFilter(cfg.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {cfg.label}
              </button>
            )
          })}
          {typeFilter.size > 0 && (
            <button
              onClick={() => { setTypeFilter(new Set()); setPage(1) }}
              className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear filters
            </button>
          )}
        </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <FileText className="w-12 h-12 opacity-30" />
            <p className="text-sm">
              {hasFilters ? 'No reports match your search or filters.' : 'No reports yet. Create one to get started.'}
            </p>
            {!hasFilters && (
              <button
                onClick={() => router.push('/vet-dashboard/reports/new')}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 text-indigo-600 text-sm hover:bg-indigo-50 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Report
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => {
              const owner = ownerName(r)
              const count = r.medicalRecordIds?.length || (r.medicalRecordId ? 1 : 0)
              return (
                <button
                  key={r._id}
                  onClick={() => router.push(`/vet-dashboard/reports/${r._id}`)}
                  className="w-full text-left bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center overflow-hidden">
                        {r.petId?.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.petId.photo} alt={r.petId?.name || 'Pet'} className="w-full h-full object-cover" />
                        ) : (
                          <PawPrint className="w-5 h-5 text-indigo-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-gray-900 group-hover:text-indigo-700 truncate">
                            {r.title || `Report: ${r.petId?.name}`}
                          </p>
                          <TypeBadge type={r.reportType} />
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.petId?.name} &middot; {r.petId?.species === 'canine' ? 'Canine' : 'Feline'} / {r.petId?.breed}
                          {count > 0 && (
                            <span className="ml-1.5 text-gray-400">
                              &middot; {r.scope === 'all' ? `All records (${count} visits)` : `${count} visit${count !== 1 ? 's' : ''}`}
                            </span>
                          )}
                        </p>
                        {owner && (
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> {owner}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <StatusBadge status={r.status} shared={r.sharedWithOwner} />
                      <span className="text-xs text-gray-400">{formatReportDate(r.reportDate)}</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-gray-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} report{total !== 1 ? 's' : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | 'gap')[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('gap')
                    acc.push(n)
                    return acc
                  }, [])
                  .map((n, i) =>
                    n === 'gap' ? (
                      <span key={`gap-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`min-w-8 px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          page === n
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
