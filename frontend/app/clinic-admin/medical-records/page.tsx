'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, type MedicalRecord } from '@/lib/medicalRecords'
import {
  FileText,
  Plus,
  PawPrint,
  Clock,
  Share2,
  ChevronDown,
  ChevronRight,
  User,
  Search,
  X,
  CalendarDays,
} from 'lucide-react'

interface PetGroup {
  petId: string
  petName: string
  petSpecies: string
  records: MedicalRecord[]
}

interface OwnerGroup {
  ownerId: string
  ownerName: string
  pets: PetGroup[]
}

export default function ClinicMedicalRecordsPage() {
  const router = useRouter()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [expandedOwners, setExpandedOwners] = useState<Record<string, boolean>>({})
  const [expandedPets, setExpandedPets] = useState<Record<string, boolean>>({})

  const fetchRecords = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await getVetMedicalRecords({ limit: 500 }, token)
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

  function getOwnerName(record: MedicalRecord): string {
    const pet = record.petId as any
    if (!pet || typeof pet !== 'object') return 'Unknown Owner'
    const owner = pet.ownerId
    if (!owner || typeof owner !== 'object') return 'Unknown Owner'
    return `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() || 'Unknown Owner'
  }

  function getOwnerId(record: MedicalRecord): string {
    const pet = record.petId as any
    if (!pet || typeof pet !== 'object') return 'unknown'
    const owner = pet.ownerId
    if (!owner || typeof owner !== 'object') return 'unknown'
    return owner._id?.toString() ?? 'unknown'
  }

  function getPetId(record: MedicalRecord): string {
    const pet = record.petId as any
    if (!pet || typeof pet !== 'object') return 'unknown'
    return pet._id?.toString() ?? 'unknown'
  }

  function getPetName(record: MedicalRecord): string {
    const pet = record.petId as any
    return pet?.name ?? '—'
  }

  function getPetSpecies(record: MedicalRecord): string {
    const pet = record.petId as any
    return pet?.species ?? ''
  }

  function getVetName(record: MedicalRecord): string {
    if (typeof record.vetId === 'object' && record.vetId) {
      const v = record.vetId as any
      return `Dr. ${v.lastName ?? ''}`.trim()
    }
    return '—'
  }

  function stageBadge(stage: MedicalRecord['stage']) {
    const map: Record<MedicalRecord['stage'], { label: string; cls: string }> = {
      pre_procedure:  { label: 'Pre',       cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
      in_procedure:   { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      post_procedure: { label: 'Post',      cls: 'bg-purple-50 text-purple-700 border-purple-200' },
      completed:      { label: 'Completed', cls: 'bg-green-50 text-green-700 border-green-200' },
    }
    const s = map[stage] ?? { label: stage, cls: 'bg-gray-50 text-gray-500 border-gray-200' }
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>
        {s.label}
      </span>
    )
  }

  const ownerGroups = useMemo<OwnerGroup[]>(() => {
    const q = search.trim().toLowerCase()
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null
    const toMs = dateTo ? new Date(dateTo + 'T23:59:59').getTime() : null

    const filtered = records.filter((rec) => {
      // Date filter
      const recMs = new Date(rec.createdAt).getTime()
      if (fromMs && recMs < fromMs) return false
      if (toMs && recMs > toMs) return false

      // Search filter
      if (q) {
        const petName = getPetName(rec).toLowerCase()
        const ownerName = getOwnerName(rec).toLowerCase()
        if (!petName.includes(q) && !ownerName.includes(q)) return false
      }

      return true
    })

    const ownerMap = new Map<string, OwnerGroup>()

    for (const rec of filtered) {
      const ownerId = getOwnerId(rec)
      const ownerName = getOwnerName(rec)
      const petId = getPetId(rec)
      const petName = getPetName(rec)
      const petSpecies = getPetSpecies(rec)

      if (!ownerMap.has(ownerId)) {
        ownerMap.set(ownerId, { ownerId, ownerName, pets: [] })
      }
      const ownerGroup = ownerMap.get(ownerId)!

      let petGroup = ownerGroup.pets.find((p) => p.petId === petId)
      if (!petGroup) {
        petGroup = { petId, petName, petSpecies, records: [] }
        ownerGroup.pets.push(petGroup)
      }
      petGroup.records.push(rec)
    }

    // Sort owners by name, pets by name, records by date desc
    const groups = Array.from(ownerMap.values())
    groups.sort((a, b) => a.ownerName.localeCompare(b.ownerName))
    for (const og of groups) {
      og.pets.sort((a, b) => a.petName.localeCompare(b.petName))
      for (const pg of og.pets) {
        pg.records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      }
    }

    return groups
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, search, dateFrom, dateTo])

  // Sync expanded defaults when groups change
  useEffect(() => {
    setExpandedOwners((prev) => {
      const next = { ...prev }
      for (const og of ownerGroups) {
        if (!(og.ownerId in next)) next[og.ownerId] = false
      }
      return next
    })
    setExpandedPets((prev) => {
      const next = { ...prev }
      for (const og of ownerGroups) {
        for (const pg of og.pets) {
          if (!(pg.petId in next)) next[pg.petId] = false
        }
      }
      return next
    })
  }, [ownerGroups])

  function toggleOwner(ownerId: string) {
    const opening = !expandedOwners[ownerId]
    setExpandedOwners((prev) => ({ ...prev, [ownerId]: opening }))
    if (opening) {
      const ownerGroup = ownerGroups.find((og) => og.ownerId === ownerId)
      if (ownerGroup) {
        setExpandedPets((prev) => {
          const next = { ...prev }
          for (const pg of ownerGroup.pets) next[pg.petId] = false
          return next
        })
      }
    }
  }

  function togglePet(petId: string) {
    setExpandedPets((prev) => ({ ...prev, [petId]: !prev[petId] }))
  }

  const hasFilters = search.trim() || dateFrom || dateTo

  function clearFilters() {
    setSearch('')
    setDateFrom('')
    setDateTo('')
  }

  const totalFiltered = ownerGroups.reduce((sum, og) => sum + og.pets.reduce((s, pg) => s + pg.records.length, 0), 0)

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#4F4F4F]">Medical Records</h1>
            <p className="text-sm text-gray-500 mt-1">
              {hasFilters
                ? `${totalFiltered} of ${total} record${total !== 1 ? 's' : ''}`
                : `${total} record${total !== 1 ? 's' : ''}`}{' '}
              across your {user?.userType === 'clinic-admin' ? 'branch' : 'clinic'}
            </p>
          </div>
          <button
            onClick={() => router.push('/clinic-admin/medical-records/new')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Record
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by pet or owner name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent"
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

          {/* Date range */}
          <div className="flex items-center gap-3">
            <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent text-gray-600"
              />
              <span className="text-gray-400 text-sm shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] focus:border-transparent text-gray-600"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-[#476B6B] shrink-0 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : ownerGroups.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            {hasFilters ? (
              <>
                <p className="text-gray-500 mb-2">No records match your filters</p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-[#476B6B] hover:underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">No medical records yet</p>
                <button
                  onClick={() => router.push('/clinic-admin/medical-records/new')}
                  className="px-4 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
                >
                  Create First Record
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {ownerGroups.map((og) => (
              <div key={og.ownerId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {/* Owner row */}
                <button
                  onClick={() => toggleOwner(og.ownerId)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-9 h-9 bg-[#f0f7f7] rounded-xl flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-[#476B6B]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#4F4F4F]">{og.ownerName}</p>
                    <p className="text-xs text-gray-400">
                      {og.pets.length} pet{og.pets.length !== 1 ? 's' : ''} &middot;{' '}
                      {og.pets.reduce((s, p) => s + p.records.length, 0)} record{og.pets.reduce((s, p) => s + p.records.length, 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {expandedOwners[og.ownerId]
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                </button>

                {/* Pets */}
                {expandedOwners[og.ownerId] && (
                  <div className="border-t border-gray-100">
                    {og.pets.map((pg, pi) => (
                      <div key={pg.petId} className={pi > 0 ? 'border-t border-gray-50' : ''}>
                        {/* Pet row */}
                        <button
                          onClick={() => togglePet(pg.petId)}
                          className="w-full flex items-center gap-3 pl-12 pr-5 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="w-8 h-8 bg-[#f7f0f7] rounded-xl flex items-center justify-center shrink-0">
                            <PawPrint className="w-4 h-4 text-[#6B4776]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-[#4F4F4F] text-sm">{pg.petName}</p>
                            <p className="text-xs text-gray-400 capitalize">{pg.petSpecies}</p>
                          </div>
                          <span className="text-xs text-gray-400 mr-2">
                            {pg.records.length} record{pg.records.length !== 1 ? 's' : ''}
                          </span>
                          {expandedPets[pg.petId]
                            ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                            : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          }
                        </button>

                        {/* Records */}
                        {expandedPets[pg.petId] && (
                          <div className="border-t border-gray-50">
                            {pg.records.map((rec, ri) => (
                              <div
                                key={rec._id}
                                onClick={() => router.push(`/clinic-admin/medical-records/${rec._id}`)}
                                className={`flex items-center gap-4 pl-20 pr-5 py-3 cursor-pointer hover:bg-[#f9fdfd] transition-colors ${ri > 0 ? 'border-t border-gray-50' : ''}`}
                              >
                                <div className="flex-1 min-w-0">
                                  {rec.visitSummary ? (
                                    <p className="text-sm text-gray-700 truncate">{rec.visitSummary}</p>
                                  ) : rec.chiefComplaint ? (
                                    <p className="text-sm text-gray-600 truncate">{rec.chiefComplaint}</p>
                                  ) : (
                                    <p className="text-sm text-gray-400 italic">No summary</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {getVetName(rec)}
                                    </span>
                                    {stageBadge(rec.stage)}
                                    {rec.sharedWithOwner && (
                                      <span className="text-xs text-blue-600 flex items-center gap-1">
                                        <Share2 className="w-3 h-3" />
                                        Shared
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="flex items-center gap-1 text-xs text-gray-400 justify-end">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(rec.createdAt)}
                                  </div>
                                  {!rec.isCurrent && (
                                    <span className="text-xs text-gray-400">Historical</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
