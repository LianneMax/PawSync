'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getStatusLabel, getStatusClasses, type Vaccination } from '@/lib/vaccinations'
import {
  Syringe,
  Plus,
  Search,
  PawPrint,
  Calendar,
  Filter,
} from 'lucide-react'

const STATUS_TABS = ['all', 'active', 'pending', 'overdue', 'expired', 'declined'] as const
type StatusTab = (typeof STATUS_TABS)[number]

export default function ClinicAdminVaccinationsPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')

  const fetchVaccinations = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (activeTab !== 'all') params.set('status', activeTab)
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/vaccinations/clinic/records?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.status === 'SUCCESS') {
        setVaccinations(data.data.vaccinations || [])
      }
    } finally {
      setLoading(false)
    }
  }, [token, activeTab])

  useEffect(() => {
    fetchVaccinations()
  }, [fetchVaccinations])

  const filtered = vaccinations.filter((v) => {
    if (!search) return true
    const q = search.toLowerCase()
    const petName = typeof v.petId === 'object' ? (v.petId as any)?.name?.toLowerCase() ?? '' : ''
    return v.vaccineName.toLowerCase().includes(q) || petName.includes(q)
  })

  function formatDate(d: string | null | undefined) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  function getPetInitial(v: Vaccination) {
    const pet = v.petId as any
    return typeof pet === 'object' ? (pet?.name?.[0] ?? '?').toUpperCase() : '?'
  }

  function getPetName(v: Vaccination) {
    const pet = v.petId as any
    return typeof pet === 'object' ? pet?.name ?? '—' : '—'
  }

  function getVetName(v: Vaccination) {
    const vet = v.vetId as any
    if (!vet) return '—'
    return typeof vet === 'object' ? `Dr. ${vet.lastName ?? ''}`.trim() : '—'
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">Vaccination Records</h1>
            <p className="text-sm text-gray-500 mt-1">All vaccination records for your clinic</p>
          </div>
          <button
            onClick={() => router.push('/clinic-admin/vaccinations/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Vaccination
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pet name or vaccine…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] bg-white"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition-all capitalize ${
                activeTab === tab
                  ? 'bg-[#476B6B] text-white border-[#476B6B]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#476B6B]'
              }`}
            >
              {tab === 'all' ? 'All' : getStatusLabel(tab as Vaccination['status'])}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Syringe className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              No {activeTab !== 'all' ? activeTab : ''} vaccination records found
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="hidden md:grid grid-cols-[40px_1fr_1fr_140px_140px_120px] gap-4 px-5 py-3 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide border-b">
              <span />
              <span>Pet</span>
              <span>Vaccine</span>
              <span>Date Given</span>
              <span>Expires</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-gray-50">
              {filtered.map((v) => (
                <button
                  key={v._id}
                  onClick={() => router.push(`/clinic-admin/vaccinations/new?edit=${v._id}`)}
                  className="w-full text-left hover:bg-[#f8fbfb] transition-colors"
                >
                  {/* Mobile card */}
                  <div className="md:hidden p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {getPetInitial(v)}
                        </div>
                        <div>
                          <p className="font-medium text-[#4F4F4F] text-sm">{getPetName(v)}</p>
                          <p className="text-xs text-gray-500">{getVetName(v)}</p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${getStatusClasses(v.status)}`}>
                        {getStatusLabel(v.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{v.vaccineName}</p>
                    <p className="text-xs text-gray-400 mt-1">Given: {formatDate(v.dateAdministered)} · Expires: {formatDate(v.expiryDate)}</p>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden md:grid grid-cols-[40px_1fr_1fr_140px_140px_120px] gap-4 items-center px-5 py-3.5">
                    <div className="w-8 h-8 bg-[#476B6B] rounded-full flex items-center justify-center text-white text-xs font-bold">
                      {getPetInitial(v)}
                    </div>
                    <div>
                      <p className="font-medium text-[#4F4F4F] text-sm">{getPetName(v)}</p>
                      <p className="text-xs text-gray-400">{getVetName(v)}</p>
                    </div>
                    <p className="text-sm text-gray-700">{v.vaccineName}</p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(v.dateAdministered)}
                    </div>
                    <p className="text-xs text-gray-500">{formatDate(v.expiryDate)}</p>
                    <span className={`inline-block text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusClasses(v.status)}`}>
                      {getStatusLabel(v.status)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
