'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, type MedicalRecord } from '@/lib/medicalRecords'
import { createVetReport, listVetReports, DuplicateReportError } from '@/lib/vetReports'
import { ArrowLeft, Search, PawPrint, CalendarDays, Loader2, CheckSquare, Square, Layers, FileText } from 'lucide-react'
import { toast } from 'sonner'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface PetGroup {
  petId: string
  name: string
  species?: string
  breed?: string
  records: MedicalRecord[]
}

export default function NewReportPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [usedRecordIds, setUsedRecordIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set())
  const [allMode, setAllMode] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [recordsRes, reportsRes] = await Promise.all([
          getVetMedicalRecords({ limit: 200 }, token || undefined),
          listVetReports({ limit: 200 }, token || undefined),
        ])
        // Only completed visits are eligible for reports
        const completed = (recordsRes.data?.records ?? []).filter((r) => r.stage === 'completed')
        setRecords(completed)
        const used = new Set<string>()
        for (const r of reportsRes.data) {
          if (r.medicalRecordId) {
            used.add(typeof r.medicalRecordId === 'object'
              ? (r.medicalRecordId as any)._id ?? String(r.medicalRecordId)
              : String(r.medicalRecordId))
          }
        }
        setUsedRecordIds(used)
      } catch {
        toast.error('Failed to load records')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // Group completed records by pet, newest visit first within each pet
  const petGroups = useMemo<PetGroup[]>(() => {
    const map = new Map<string, PetGroup>()
    for (const r of records) {
      const pet = typeof r.petId === 'object' && r.petId ? r.petId : null
      if (!pet?._id) continue
      let group = map.get(pet._id)
      if (!group) {
        group = { petId: pet._id, name: pet.name ?? 'Unknown pet', species: pet.species, breed: pet.breed, records: [] }
        map.set(pet._id, group)
      }
      group.records.push(r)
    }
    for (const g of map.values()) {
      g.records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [records])

  const filteredPets = petGroups.filter((g) => {
    const q = search.toLowerCase()
    return !q || g.name.toLowerCase().includes(q)
  })

  const selectedPet = petGroups.find((g) => g.petId === selectedPetId) ?? null

  const selectPet = (petId: string) => {
    setSelectedPetId(petId)
    setSelectedRecordIds(new Set())
    setAllMode(false)
  }

  const toggleRecord = (recordId: string) => {
    if (allMode) return
    setSelectedRecordIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return next
    })
  }

  const effectiveCount = allMode ? (selectedPet?.records.length ?? 0) : selectedRecordIds.size

  const handleCreate = async () => {
    if (!selectedPet) {
      toast.error('Please select a patient')
      return
    }
    if (!allMode && selectedRecordIds.size === 0) {
      toast.error('Select at least one medical record')
      return
    }
    setCreating(true)
    try {
      const recordIds = allMode ? selectedPet.records.map((r) => r._id) : [...selectedRecordIds]
      const isConsolidated = allMode || recordIds.length > 1
      const singleRecord = !isConsolidated ? selectedPet.records.find((r) => r._id === recordIds[0]) : null
      const defaultTitle = title.trim() || (isConsolidated
        ? `Consolidated Report: ${selectedPet.name} (${recordIds.length} visit${recordIds.length !== 1 ? 's' : ''})`
        : `Diagnostic Report: ${selectedPet.name} (${fmtDate(singleRecord?.createdAt ?? new Date().toISOString())})`)

      const report = await createVetReport(
        {
          petId: selectedPet.petId,
          medicalRecordIds: allMode ? undefined : recordIds,
          scope: allMode ? 'all' : 'selected',
          title: defaultTitle,
        },
        token || undefined
      )
      router.push(`/vet-dashboard/reports/${report._id}`)
    } catch (e: any) {
      if (e instanceof DuplicateReportError) {
        toast.info('A report already exists for this record — opening it')
        router.push(`/vet-dashboard/reports/${e.existingReportId}`)
        return
      }
      toast.error(e.message || 'Failed to create report')
      setCreating(false)
    }
  }

  return (
    <DashboardLayout userType={user?.userType as any}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <PageHeader
          title="New Report"
          subtitle="Pick a patient, then choose which completed visits the report should cover"
          className="mb-6"
        />

        {/* Title (optional) */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Title (optional)</label>
          <input
            type="text"
            placeholder="e.g. Consolidated Report — Chewie — 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Step 1: Pet selector */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            1. Patient <span className="text-gray-400 font-normal">(required)</span>
          </label>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50">
              {filteredPets.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {search ? 'No patients match your search' : 'No completed medical records yet'}
                </p>
              ) : (
                filteredPets.map((g) => {
                  const isSelected = selectedPetId === g.petId
                  return (
                    <button
                      key={g.petId}
                      onClick={() => selectPet(g.petId)}
                      className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                          : 'border-gray-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <PawPrint className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">{g.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {g.species === 'canine' ? 'Canine' : 'Feline'} / {g.breed}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {g.records.length} visit{g.records.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Step 2: Record selection */}
        {selectedPet && (
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              2. Visits to include
            </label>

            {/* All-records toggle */}
            <button
              onClick={() => { setAllMode((v) => !v); setSelectedRecordIds(new Set()) }}
              className={`w-full mb-3 rounded-lg px-4 py-3 border text-left transition-all flex items-center gap-3 ${
                allMode
                  ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                  : 'border-gray-200 bg-white hover:border-indigo-200'
              }`}
            >
              <Layers className={`w-4 h-4 flex-shrink-0 ${allMode ? 'text-indigo-500' : 'text-gray-400'}`} />
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">All records to date</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  One consolidated report covering all {selectedPet.records.length} completed visit{selectedPet.records.length !== 1 ? 's' : ''}. New visits can be folded in later.
                </p>
              </div>
              {allMode ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-gray-300" />}
            </button>

            <div className={`max-h-64 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 ${allMode ? 'opacity-60' : ''}`}>
              {selectedPet.records.map((r) => {
                const checked = allMode || selectedRecordIds.has(r._id)
                const hasReport = usedRecordIds.has(r._id)
                return (
                  <button
                    key={r._id}
                    onClick={() => toggleRecord(r._id)}
                    disabled={allMode}
                    className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                      checked
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-indigo-200'
                    } ${allMode ? 'cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      {checked
                        ? <CheckSquare className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-gray-900 truncate">
                          {r.chiefComplaint || 'Visit'}
                        </p>
                        {hasReport && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                            <FileText className="w-3 h-3" /> Already has a single-visit report
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                        <CalendarDays className="w-3 h-3" />
                        {fmtDate(r.createdAt)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {selectedPet && effectiveCount > 0 && (
          <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
            <strong>{selectedPet.name}</strong> — {allMode
              ? `all records to date (${effectiveCount} visits, auto-updatable)`
              : `${effectiveCount} visit${effectiveCount !== 1 ? 's' : ''} selected`}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!selectedPet || effectiveCount === 0 || creating}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </>
          ) : (
            'Create Report & Open Editor'
          )}
        </button>
      </div>
    </DashboardLayout>
  )
}
