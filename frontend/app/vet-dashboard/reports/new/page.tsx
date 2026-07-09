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

/** These types stand alone — they cannot be combined with any other type. */
const EXCLUSIVE_TYPES: ReportType[] = ['healthCertificate', 'referralLetter']

/** Update-with-new-visits is not available for these types yet (backend rejects sync). */
const SYNC_DISABLED_TYPES: ReportType[] = ['soap', 'surgery', 'dischargeSummary']

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

/** Record must satisfy every selected type so each created report covers the same visits. */
function isEligibleForAllTypes(record: MedicalRecord, reportTypes: ReportType[]): boolean {
  return reportTypes.every((t) => isEligibleForType(record, t))
}

export default function NewReportPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedTypes, setSelectedTypes] = useState<Set<ReportType>>(new Set())

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

  const typeList = useMemo(() => [...selectedTypes], [selectedTypes])
  const syncDisabled = typeList.some((t) => SYNC_DISABLED_TYPES.includes(t))

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

  const toggleType = (type: ReportType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
        return next
      }
      // Exclusive types replace the whole selection; picking a normal type drops any exclusive
      if (EXCLUSIVE_TYPES.includes(type)) return new Set([type])
      for (const ex of EXCLUSIVE_TYPES) next.delete(ex)
      next.add(type)
      return next
    })
    // Selection rules may change (e.g. SOAP added) — reset record picks
    setSelectedRecordIds(new Set())
    setAllMode(false)
  }

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
      g.records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [records])

  // Pets that have at least one record eligible for every selected type
  const eligiblePetGroups = useMemo(() => {
    if (typeList.length === 0) return petGroups
    return petGroups.filter((g) => g.records.some((r) => isEligibleForAllTypes(r, typeList)))
  }, [petGroups, typeList])

  const filteredPets = eligiblePetGroups.filter((g) => {
    const q = petSearch.toLowerCase()
    return !q || g.name.toLowerCase().includes(q)
  })

  const selectedPet = petGroups.find((g) => g.petId === selectedPetId) ?? null

  // Records eligible for every selected type + inside the optional date range
  const eligibleRecords = useMemo(() => {
    if (!selectedPet || typeList.length === 0) return []
    return selectedPet.records.filter((r) => {
      if (!isEligibleForAllTypes(r, typeList)) return false
      if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false
      if (dateTo && new Date(r.createdAt) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
  }, [selectedPet, typeList, dateFrom, dateTo])

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

  const toggleAllMode = () => {
    setAllMode((v) => !v)
    setSelectedRecordIds(new Set())
  }

  const effectiveCount = allMode ? eligibleRecords.length : selectedRecordIds.size
  // Pet must still be eligible — going back and changing types can invalidate an earlier pick
  const canProceedStep2 = !!selectedPetId && eligiblePetGroups.some((g) => g.petId === selectedPetId)

  const handleCreate = async () => {
    if (!selectedPet || typeList.length === 0) {
      toast.error('Select a patient and at least one report type')
      return
    }
    if (effectiveCount === 0) {
      toast.error('Select at least one medical record')
      return
    }
    setCreating(true)
    try {
      // allMode without a date range → scope 'all' (auto-updatable); otherwise explicit IDs
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

      // Create one report per selected type, in the order they appear in the config
      const orderedTypes = REPORT_TYPE_CONFIG.map((c) => c.value).filter((t) => selectedTypes.has(t))
      const created: { id: string; label: string }[] = []
      const skipped: { id: string; label: string }[] = []
      const failed: string[] = []

      for (const type of orderedTypes) {
        const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === type)?.label ?? 'Report'
        const autoTitle = isConsolidated
          ? `${typeLabel}: ${selectedPet.name} (${useAllScope ? 'All records' : `${recordIds?.length} visits`})`
          : `${typeLabel}: ${selectedPet.name} (${fmtDate(singleRecord?.createdAt ?? new Date().toISOString())})`
        // Custom title only makes sense verbatim for a single type; prefix it per type otherwise
        const reportTitle = title.trim()
          ? (orderedTypes.length > 1 ? `${typeLabel}: ${title.trim()}` : title.trim())
          : autoTitle
        try {
          const report = await createVetReport(
            {
              petId: selectedPet.petId,
              reportType: type,
              medicalRecordIds: recordIds,
              scope: useAllScope ? 'all' : 'selected',
              title: reportTitle,
            },
            token || undefined
          )
          created.push({ id: report._id, label: typeLabel })
        } catch (e: any) {
          if (e instanceof DuplicateReportError) {
            // Same type covering exactly this record set already exists — don't duplicate
            skipped.push({ id: e.existingReportId, label: typeLabel })
          } else {
            failed.push(typeLabel)
            console.error(`Failed to create ${typeLabel}:`, e)
          }
        }
      }

      if (skipped.length > 0) {
        toast.info(`Already exist${skipped.length === 1 ? 's' : ''} for this selection: ${skipped.map((s) => s.label).join(', ')}`)
      }
      if (failed.length > 0) {
        toast.error(`Could not create: ${failed.join(', ')}`)
      }

      if (created.length === 1 && skipped.length === 0) {
        router.push(`/vet-dashboard/reports/${created[0].id}`)
      } else if (created.length > 0) {
        toast.success(`Created ${created.length} report${created.length !== 1 ? 's' : ''}: ${created.map((c) => c.label).join(', ')}`)
        router.push('/vet-dashboard/reports')
      } else if (skipped.length === 1 && failed.length === 0) {
        // Nothing new — open the existing report
        router.push(`/vet-dashboard/reports/${skipped[0].id}`)
      } else if (skipped.length > 0 && failed.length === 0) {
        router.push('/vet-dashboard/reports')
      } else {
        setCreating(false)
        return
      }
    } catch (e: any) {
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

  const stepLabels = ['Report Types', 'Patient', 'Records']

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
          subtitle="Choose one or more report types, pick a patient, and select the visits to include"
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

        {/* ── Step 1: Report Types (multi-select) ── */}
        {step === 1 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              What type of report do you want to create?
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Select one or more — a separate report is created for each type. Health Certificate and Referral Letter cannot be combined with other types.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {REPORT_TYPE_CONFIG.map((cfg) => {
                const selected = selectedTypes.has(cfg.value)
                const isExclusive = EXCLUSIVE_TYPES.includes(cfg.value)
                return (
                  <button
                    key={cfg.value}
                    onClick={() => toggleType(cfg.value)}
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
                      <span className="ml-auto">
                        {selected
                          ? <CheckSquare className="w-4 h-4 text-indigo-500" />
                          : <Square className="w-4 h-4 text-gray-300" />}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{cfg.description}</p>
                    {isExclusive && (
                      <p className="text-[10px] text-amber-600 mt-1.5">Standalone — cannot be combined with other types</p>
                    )}
                  </button>
                )
              })}
            </div>

            {selectedTypes.size > 1 && (
              <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-700">
                {selectedTypes.size} reports will be created — one per selected type, all covering the same visits.
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={selectedTypes.size === 0}
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
              {selectedTypes.size > 1 && title.trim() && (
                <p className="text-xs text-gray-400 mt-1">Each report&apos;s title will be prefixed with its type.</p>
              )}
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
                      : 'No patients with records eligible for the selected report types'}
                  </p>
                ) : (
                  filteredPets.map((g) => {
                    const isSelected = selectedPetId === g.petId
                    const eligibleCount = g.records.filter((r) => isEligibleForAllTypes(r, typeList)).length
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
              <span className="ml-auto text-xs text-indigo-500">
                {typeList.length} report{typeList.length !== 1 ? 's' : ''}
              </span>
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
            </label>

            {/* All-records toggle */}
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
                  {!(dateFrom || dateTo) && !syncDisabled && ' — new visits can be folded in later'}
                </p>
              </div>
              {allMode ? <CheckSquare className="w-4 h-4 text-indigo-500" /> : <Square className="w-4 h-4 text-gray-300" />}
            </button>

            {/* Record list */}
            <div className={`max-h-72 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 mb-4 ${allMode ? 'opacity-60' : ''}`}>
              {eligibleRecords.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">
                  {dateFrom || dateTo
                    ? 'No eligible records in this date range'
                    : 'No records eligible for all selected report types'}
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
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {r.chiefComplaint || 'Visit'}
                          </p>
                          {hasReport && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                              <FileText className="w-3 h-3" /> Has existing report(s) — more can be created
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
                {typeList.length > 1 && ` → ${typeList.length} reports`}
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
                  `Create ${typeList.length > 1 ? `${typeList.length} Reports` : 'Report'} & Open`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
