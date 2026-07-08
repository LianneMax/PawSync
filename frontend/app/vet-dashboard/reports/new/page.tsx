'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, type MedicalRecord } from '@/lib/medicalRecords'
import {
  createVetReport,
  listVetReports,
  DuplicateReportError,
  REPORT_TYPE_CONFIG,
  type ReportType,
} from '@/lib/vetReports'
import {
  ArrowLeft,
  Search,
  PawPrint,
  CalendarDays,
  Loader2,
  CheckSquare,
  Square,
  Layers,
  FileText,
  ClipboardList,
  FlaskConical,
  Scissors,
  Shield,
  Home,
  Mail,
  ChevronRight,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

const REPORT_TYPE_ICONS: Record<ReportType, React.ReactNode> = {
  general: <FileText className="w-5 h-5" />,
  soap: <ClipboardList className="w-5 h-5" />,
  diagnostic: <FlaskConical className="w-5 h-5" />,
  surgery: <Scissors className="w-5 h-5" />,
  healthCertificate: <Shield className="w-5 h-5" />,
  dischargeSummary: <Home className="w-5 h-5" />,
  referralLetter: <Mail className="w-5 h-5" />,
}

interface PetGroup {
  petId: string
  name: string
  species?: string
  breed?: string
  records: MedicalRecord[]
}

function isEligibleForType(record: MedicalRecord, reportType: ReportType): boolean {
  if (reportType === 'diagnostic') return (record.diagnosticTests?.length ?? 0) > 0
  if (reportType === 'surgery') return !!(record.surgeryRecord?.surgeryType)
  return true
}

export default function NewReportPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [reportType, setReportType] = useState<ReportType | null>(null)

  // Data
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [usedRecordIds, setUsedRecordIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // Step 2 state
  const [petSearch, setPetSearch] = useState('')
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)

  // Step 3 state
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set())
  const [allMode, setAllMode] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Creation
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const isSoap = reportType === 'soap'

  useEffect(() => {
    const load = async () => {
      try {
        const [recordsRes, reportsRes] = await Promise.all([
          getVetMedicalRecords({ limit: 200 }, token || undefined),
          listVetReports({ limit: 200 }, token || undefined),
        ])
        const completed = (recordsRes.data?.records ?? []).filter((r) => r.stage === 'completed')
        setRecords(completed)
        const used = new Set<string>()
        for (const r of reportsRes.data) {
          if (r.medicalRecordId) {
            used.add(
              typeof r.medicalRecordId === 'object'
                ? (r.medicalRecordId as any)._id ?? String(r.medicalRecordId)
                : String(r.medicalRecordId)
            )
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

  // Group records by pet, newest visit first within each pet
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
      // newest first in display
      g.records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [records])

  // Pet groups filtered by type eligibility (hide pets with no eligible records for diagnostic/surgery)
  const eligiblePetGroups = useMemo(() => {
    if (!reportType) return petGroups
    if (reportType === 'diagnostic' || reportType === 'surgery') {
      return petGroups.filter((g) => g.records.some((r) => isEligibleForType(r, reportType)))
    }
    return petGroups
  }, [petGroups, reportType])

  const filteredPets = eligiblePetGroups.filter((g) => {
    const q = petSearch.toLowerCase()
    return !q || g.name.toLowerCase().includes(q)
  })

  const selectedPet = petGroups.find((g) => g.petId === selectedPetId) ?? null

  // Records filtered by type + date range, sorted newest first
  const eligibleRecords = useMemo(() => {
    if (!selectedPet || !reportType) return []
    return selectedPet.records.filter((r) => {
      if (!isEligibleForType(r, reportType)) return false
      if (dateFrom) {
        const d = new Date(r.createdAt)
        if (d < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const d = new Date(r.createdAt)
        if (d > new Date(dateTo + 'T23:59:59')) return false
      }
      return true
    })
  }, [selectedPet, reportType, dateFrom, dateTo])

  const selectPet = (petId: string) => {
    setSelectedPetId(petId)
    setSelectedRecordIds(new Set())
    setAllMode(false)
  }

  const toggleRecord = (recordId: string) => {
    if (allMode) return
    if (isSoap) {
      // single-select for SOAP
      setSelectedRecordIds(new Set([recordId]))
      return
    }
    setSelectedRecordIds((prev) => {
      const next = new Set(prev)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return next
    })
  }

  const toggleAllMode = () => {
    if (isSoap) return
    setAllMode((v) => !v)
    setSelectedRecordIds(new Set())
  }

  const effectiveCount = allMode ? eligibleRecords.length : selectedRecordIds.size

  const canProceedStep2 = !!selectedPetId
  const canProceedStep3 = effectiveCount > 0 || (!allMode && selectedRecordIds.size > 0)

  const handleCreate = async () => {
    if (!selectedPet || !reportType) {
      toast.error('Select a patient')
      return
    }
    if (effectiveCount === 0) {
      toast.error('Select at least one medical record')
      return
    }
    setCreating(true)
    try {
      // When allMode + no date range: use scope 'all'. With date range: use explicit IDs.
      const hasDateFilter = !!dateFrom || !!dateTo
      const useAllScope = allMode && !hasDateFilter

      const recordIds = useAllScope
        ? undefined
        : allMode
          ? eligibleRecords.map((r) => r._id)
          : [...selectedRecordIds]

      const isConsolidated = useAllScope || (recordIds?.length ?? 0) > 1
      const singleRecord = !isConsolidated && recordIds?.length === 1
        ? selectedPet.records.find((r) => r._id === recordIds![0])
        : null

      const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === reportType)?.label ?? 'Report'
      const defaultTitle = title.trim() || (isConsolidated
        ? `${typeLabel}: ${selectedPet.name} (${useAllScope ? 'All records' : `${recordIds?.length} visits`})`
        : `${typeLabel}: ${selectedPet.name} (${fmtDate(singleRecord?.createdAt ?? new Date().toISOString())})`)

      const report = await createVetReport(
        {
          petId: selectedPet.petId,
          reportType,
          medicalRecordIds: recordIds,
          scope: useAllScope ? 'all' : 'selected',
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

  const clearDates = () => {
    setDateFrom('')
    setDateTo('')
    setSelectedRecordIds(new Set())
    setAllMode(false)
  }

  const stepLabels = ['Report Type', 'Patient', 'Records']

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
          subtitle="Choose a report type, pick a patient, and select the visits to include"
          className="mb-6"
        />

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {stepLabels.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-sm font-medium ${active ? 'text-indigo-600' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${active ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                    {done ? '✓' : n}
                  </span>
                  {label}
                </div>
                {i < stepLabels.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Step 1: Report Type ── */}
        {step === 1 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              What type of report do you want to create?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {REPORT_TYPE_CONFIG.map((cfg) => {
                const selected = reportType === cfg.value
                return (
                  <button
                    key={cfg.value}
                    onClick={() => setReportType(cfg.value)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      selected
                        ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                        : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={selected ? 'text-indigo-500' : 'text-gray-400'}>
                        {REPORT_TYPE_ICONS[cfg.value]}
                      </span>
                      <span className={`font-semibold text-sm ${selected ? 'text-indigo-700' : 'text-gray-800'}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{cfg.description}</p>
                  </button>
                )
              })}
            </div>

            {isSoap && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                SOAP Notes are per-visit — you will select a single medical record.
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={!reportType}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next: Select Patient <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Step 2: Patient ── */}
        {step === 2 && (
          <div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Title (optional)</label>
              <input
                type="text"
                placeholder="Leave blank to auto-generate"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Select Patient <span className="text-gray-400 font-normal">(required)</span>
            </label>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by patient name…"
                value={petSearch}
                onChange={(e) => setPetSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 mb-5">
                {filteredPets.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 py-8">
                    {petSearch
                      ? 'No patients match your search'
                      : reportType === 'diagnostic'
                        ? 'No patients with diagnostic test records'
                        : reportType === 'surgery'
                          ? 'No patients with surgery records'
                          : 'No completed medical records yet'}
                  </p>
                ) : (
                  filteredPets.map((g) => {
                    const isSelected = selectedPetId === g.petId
                    const eligibleCount = reportType
                      ? g.records.filter((r) => isEligibleForType(r, reportType)).length
                      : g.records.length
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
                            {eligibleCount} visit{eligibleCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next: Select Records <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Records ── */}
        {step === 3 && selectedPet && (
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm">
              <PawPrint className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span className="font-medium text-gray-900">{selectedPet.name}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500 text-xs">{selectedPet.species === 'canine' ? 'Canine' : 'Feline'} / {selectedPet.breed}</span>
            </div>

            {/* Date range filter */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Date Range (optional)</span>
                {(dateFrom || dateTo) && (
                  <button onClick={clearDates} className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setSelectedRecordIds(new Set()); setAllMode(false) }}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="self-center text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setSelectedRecordIds(new Set()); setAllMode(false) }}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Visits to include
              {isSoap && <span className="ml-1 text-xs text-gray-400 font-normal">(select one)</span>}
            </label>

            {/* All-records toggle (not for SOAP) */}
            {!isSoap && (
              <button
                onClick={toggleAllMode}
                className={`w-full mb-3 rounded-lg px-4 py-3 border text-left transition-all flex items-center gap-3 ${
                  allMode
                    ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                    : 'border-gray-200 bg-white hover:border-indigo-200'
                }`}
              >
                <Layers className={`w-4 h-4 flex-shrink-0 ${allMode ? 'text-indigo-500' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">
                    {dateFrom || dateTo ? 'All records in date range' : 'All records to date'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {eligibleRecords.length} eligible visit{eligibleRecords.length !== 1 ? 's' : ''}
                    {!(dateFrom || dateTo) && ' — new visits can be folded in later'}
                  </p>
                </div>
                {allMode ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-gray-300" />}
              </button>
            )}

            {/* Record list */}
            <div className={`max-h-72 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 mb-4 ${allMode ? 'opacity-60' : ''}`}>
              {eligibleRecords.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {dateFrom || dateTo
                    ? 'No eligible records in this date range'
                    : reportType === 'diagnostic'
                      ? 'No records with diagnostic tests'
                      : reportType === 'surgery'
                        ? 'No surgery records'
                        : 'No completed records'}
                </p>
              ) : (
                eligibleRecords.map((r) => {
                  const checked = allMode || selectedRecordIds.has(r._id)
                  const hasReport = usedRecordIds.has(r._id)
                  return (
                    <button
                      key={r._id}
                      onClick={() => toggleRecord(r._id)}
                      disabled={allMode}
                      className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                        checked ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:border-indigo-200'
                      } ${allMode ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {isSoap ? (
                          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${checked ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'}`} />
                        ) : checked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {r.chiefComplaint || 'Visit'}
                          </p>
                          {hasReport && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 mt-0.5">
                              <FileText className="w-3 h-3" /> Already has a report
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
                })
              )}
            </div>

            {effectiveCount > 0 && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
                <strong>{selectedPet.name}</strong> — {allMode
                  ? `${!(dateFrom || dateTo) ? 'all records to date' : 'all in date range'} (${effectiveCount} visit${effectiveCount !== 1 ? 's' : ''})`
                  : `${effectiveCount} visit${effectiveCount !== 1 ? 's' : ''} selected`}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreate}
                disabled={effectiveCount === 0 || creating}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                ) : (
                  'Create Report & Open Editor'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
