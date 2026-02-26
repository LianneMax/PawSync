'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  Syringe,
  Plus,
  Search,
  ChevronRight,
  AlertCircle,
  Loader,
} from 'lucide-react'
import {
  getVetVaccinations,
  getStatusLabel,
  getStatusClasses,
  type Vaccination,
} from '@/lib/vaccinations'

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'expired', label: 'Expired' },
  { value: 'declined', label: 'Declined' },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getPetName(vax: Vaccination): string {
  if (typeof vax.petId === 'object' && vax.petId !== null) {
    return (vax.petId as any).name || 'Unknown Pet'
  }
  return 'Unknown Pet'
}

function getPetSpecies(vax: Vaccination): string {
  if (typeof vax.petId === 'object' && vax.petId !== null) {
    return (vax.petId as any).species || ''
  }
  return ''
}

export default function VetVaccinationsPage() {
  const router = useRouter()
  const { token } = useAuthStore()

  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  const loadVaccinations = useCallback(async () => {
    if (!token) return
    try {
      setLoading(true)
      setError(null)
      const data = await getVetVaccinations(token, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
      })
      setVaccinations(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vaccinations')
    } finally {
      setLoading(false)
    }
  }, [token, statusFilter])

  useEffect(() => {
    loadVaccinations()
  }, [loadVaccinations])

  const filtered = vaccinations.filter((vax) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    const petName = getPetName(vax).toLowerCase()
    const vaccineName = vax.vaccineName.toLowerCase()
    return petName.includes(term) || vaccineName.includes(term)
  })

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7FA5A3]/10 rounded-xl flex items-center justify-center">
              <Syringe className="w-5 h-5 text-[#7FA5A3]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#4F4F4F]">Vaccination Records</h1>
              <p className="text-sm text-gray-500">Manage and track pet vaccinations</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/vet-dashboard/vaccinations/new')}
            className="flex items-center gap-2 bg-[#476B6B] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3d5c5c] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vaccination
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-[#476B6B] text-white'
                  : 'bg-[#F8F6F2] text-gray-600 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pet name or vaccine..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#F8F6F2] border border-transparent rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-[#7FA5A3] animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No vaccination records found</p>
            <p className="text-gray-400 text-sm mt-1">
              {search ? 'Try a different search term.' : 'Add a vaccination to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((vax) => (
              <button
                key={vax._id}
                onClick={() => router.push(`/vet-dashboard/vaccinations/new?edit=${vax._id}`)}
                className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-[#7FA5A3]/40 hover:bg-[#F8F6F2] transition-all text-left"
              >
                {/* Pet avatar */}
                <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center shrink-0">
                  <span className="text-[#476B6B] font-bold text-sm">
                    {getPetName(vax).charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-[#4F4F4F] text-sm truncate">{vax.vaccineName}</p>
                    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full shrink-0 ${getStatusClasses(vax.status)}`}>
                      {getStatusLabel(vax.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate capitalize">
                    {getPetName(vax)}
                    {getPetSpecies(vax) ? ` · ${getPetSpecies(vax)}` : ''}
                  </p>
                  <div className="flex gap-3 mt-1 text-[11px] text-gray-400">
                    <span>Given: {formatDate(vax.dateAdministered)}</span>
                    {vax.expiryDate && (
                      <span>Expires: {formatDate(vax.expiryDate)}</span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-4">
            {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
