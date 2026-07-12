'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, isRecordReportReady, type MedicalRecord } from '@/lib/medicalRecords'
import { DateRangePicker } from '@/components/DateRangePicker'
import { authenticatedFetch } from '@/lib/auth'
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
  Stethoscope,
} from 'lucide-react'
import { toast } from 'sonner'

interface ConfinementStay {
  _id: string
  petId: { _id: string; name: string; species?: string; breed?: string; photo?: string }
  reason: string
  notes?: string
  admissionDate: string
  dischargeDate?: string | null
  status: 'admitted' | 'discharged'
  /** Visits folded into this stay; combined report types are scoped to these records. */
  medicalRecordIds: string[]
}

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
  confinement: <Stethoscope className="w-5 h-5" />,
}

/** These types stand alone; they cannot be combined with any other type, including confinement. */
const EXCLUSIVE_TYPES: ReportType[] = ['healthCertificate', 'referralLetter']

/** Step 1 groups: clinical reports (combinable with confinement) vs. standalone documents. */
const TYPE_CATEGORIES: { label: string; description: string; types: ReportType[] }[] = [
  {
    label: 'Reports',
    description: 'Clinical write-ups built from visit data. Combine freely, including with a confinement report; one report is created per type.',
    types: ['general', 'soap', 'diagnostic', 'surgery', 'dischargeSummary'],
  },
  {
    label: 'Confinement',
    description: 'Documents a single inpatient stay: admission, monitoring log, and current status. Can be combined with Reports above, scoped to the same stay; not combinable with certificates or letters.',
    types: ['confinement'],
  },
  {
    label: 'Certificates & Letters',
    description: 'Standalone documents. Created on their own and cannot be combined with any other type.',
    types: ['healthCertificate', 'referralLetter'],
  },
]

/** Update-with-new-visits is not available for these types yet (backend rejects sync). */
const SYNC_DISABLED_TYPES: ReportType[] = ['soap', 'surgery', 'dischargeSummary', 'confinement']

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

/**
 * Record must satisfy at least one selected type — each selected type becomes its own
 * report (see handleCreate), so a record only needs to be usable by one of them to
 * belong in the candidate list. Per-report record sets are narrowed by type at creation time.
 */
function isEligibleForAnyType(record: MedicalRecord, reportTypes: ReportType[]): boolean {
  return reportTypes.some((t) => isEligibleForType(record, t))
}

function NewReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { token, user } = useAuthStore()

  // Deep-link prefill (e.g. patient-records "New Report" button)
  const prefillPetId = searchParams.get('petId')
  const prefillRecordId = searchParams.get('recordId')
  const prefillApplied = useRef(false)

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selectedTypes, setSelectedTypes] = useState<Set<ReportType>>(new Set())

  // Data
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [usedRecordIds, setUsedRecordIds] = useState<Set<string>>(new Set())
  // recordId → report types that already cover exactly that one record (duplicate hints)
  const [singleRecordReportTypes, setSingleRecordReportTypes] = useState<Record<string, ReportType[]>>({})
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

  // Confinement flow: a report is scoped to one stay, not a free record selection
  const [confinementStays, setConfinementStays] = useState<ConfinementStay[]>([])
  const [confinementLoading, setConfinementLoading] = useState(false)
  const [confinementSearch, setConfinementSearch] = useState('')
  const [selectedConfinementId, setSelectedConfinementId] = useState<string | null>(null)
  const [usedConfinementIds, setUsedConfinementIds] = useState<Set<string>>(new Set())

  const typeList = useMemo(() => [...selectedTypes], [selectedTypes])
  const syncDisabled = typeList.some((t) => SYNC_DISABLED_TYPES.includes(t))
  // Discharge summary covers exactly one visit — record selection collapses to single-pick
  const singleRecordOnly = selectedTypes.has('dischargeSummary')
  // Confinement scopes the whole selection to one stay: pick the stay instead of a
  // free patient/record search, and skip step 3 (the stay's own visits are the scope).
  const includesConfinement = selectedTypes.has('confinement')

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
        const singleMap: Record<string, ReportType[]> = {}
        for (const r of reportsRes.data) {
          if (r.medicalRecordId) {
            used.add(
              typeof r.medicalRecordId === 'object'
                ? (r.medicalRecordId as any)._id ?? String(r.medicalRecordId)
                : String(r.medicalRecordId)
            )
          }
          // Track which types already cover exactly one record — powers duplicate hints
          const ids = (r.medicalRecordIds?.length
            ? r.medicalRecordIds
            : r.medicalRecordId ? [r.medicalRecordId] : []
          ).map((x) => (typeof x === 'object' && x !== null ? (x as any)._id : String(x)))
          if (ids.length === 1 && r.reportType) {
            ;(singleMap[ids[0]] ||= []).push(r.reportType)
          }
        }
        setUsedRecordIds(used)
        setSingleRecordReportTypes(singleMap)
      } catch {
        toast.error('Failed to load records')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  // Fetch confinement stays + which ones already have a confinement report, once, when
  // the vet enters a flow that includes a confinement report.
  useEffect(() => {
    if (!includesConfinement || confinementStays.length > 0 || confinementLoading) return
    const load = async () => {
      setConfinementLoading(true)
      try {
        const [staysRes, reportsRes] = await Promise.all([
          authenticatedFetch('/confinement', { method: 'GET' }, token || undefined),
          listVetReports({ limit: 200, types: ['confinement'] }, token || undefined),
        ])
        if (staysRes?.status === 'SUCCESS') {
          setConfinementStays(staysRes.data?.records ?? [])
        } else {
          toast.error('Failed to load confinement stays')
        }
        const used = new Set<string>()
        for (const r of reportsRes.data) {
          const cid = r.confinementRecordId
          if (cid) used.add(typeof cid === 'object' ? cid._id : String(cid))
        }
        setUsedConfinementIds(used)
      } catch {
        toast.error('Failed to load confinement stays')
      } finally {
        setConfinementLoading(false)
      }
    }
    load()
  }, [includesConfinement, confinementStays.length, confinementLoading, token])

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

  // Pets that have at least one record eligible for every selected type. Records
  // with pending emergency documentation still surface the pet — the visit list
  // shows them disabled with a hint instead of silently hiding the patient.
  const eligiblePetGroups = useMemo(() => {
    if (typeList.length === 0) return petGroups
    return petGroups.filter((g) => g.records.some((r) => isEligibleForAnyType(r, typeList)))
  }, [petGroups, typeList])

  const filteredPets = eligiblePetGroups.filter((g) => {
    const q = petSearch.toLowerCase()
    return !q || g.name.toLowerCase().includes(q)
  })

  const selectedPet = petGroups.find((g) => g.petId === selectedPetId) ?? null

  // Records eligible for every selected type + inside the optional date range.
  // Emergency records with deferred documentation are split out: shown disabled
  // with a hint instead of being selectable.
  const { eligibleRecords, pendingDocRecords } = useMemo(() => {
    if (!selectedPet || typeList.length === 0) return { eligibleRecords: [], pendingDocRecords: [] }
    const inScope = selectedPet.records.filter((r) => {
      if (!isEligibleForAnyType(r, typeList)) return false
      if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false
      if (dateTo && new Date(r.createdAt) > new Date(dateTo + 'T23:59:59')) return false
      return true
    })
    return {
      eligibleRecords: inScope.filter((r) => isRecordReportReady(r)),
      pendingDocRecords: inScope.filter((r) => !isRecordReportReady(r)),
    }
  }, [selectedPet, typeList, dateFrom, dateTo])

  const selectPet = (petId: string) => {
    setSelectedPetId(petId)
    setSelectedRecordIds(new Set())
    setAllMode(false)
  }

  // Changing types can make previously picked records ineligible — prune instead of
  // clearing everything so deep-link prefills and manual picks survive type changes
  useEffect(() => {
    if (!selectedPet || typeList.length === 0) return
    setSelectedRecordIds((prev) => {
      if (prev.size === 0) return prev
      let next = new Set(
        [...prev].filter((rid) => {
          const r = selectedPet.records.find((rr) => rr._id === rid)
          return !!r && isRecordReportReady(r) && isEligibleForAnyType(r, typeList)
        })
      )
      if (singleRecordOnly && next.size > 1) next = new Set([[...next][0]])
      return next.size === prev.size ? prev : next
    })
    if (singleRecordOnly && allMode) setAllMode(false)
  }, [typeList, selectedPet, singleRecordOnly, allMode])

  // Apply deep-link prefill once records are loaded: preselect pet + visit and pick
  // a sensible default report type from the visit's content
  useEffect(() => {
    if (prefillApplied.current || loading || !prefillPetId) return
    const group = petGroups.find((g) => g.petId === prefillPetId)
    if (!group) return
    prefillApplied.current = true
    setSelectedPetId(prefillPetId)
    const rec = prefillRecordId
      ? group.records.find((r) => r._id === prefillRecordId && isRecordReportReady(r))
      : null
    if (rec) {
      setSelectedRecordIds(new Set([rec._id]))
      setSelectedTypes((prev) => {
        if (prev.size > 0) return prev
        const smartDefault: ReportType = rec.surgeryRecord?.surgeryType
          ? 'surgery'
          : rec.discharge
            ? 'dischargeSummary'
            : (rec.diagnosticTests?.length ?? 0) > 0
              ? 'diagnostic'
              : 'general'
        return new Set([smartDefault])
      })
    }
  }, [loading, petGroups, prefillPetId, prefillRecordId])

  const toggleRecord = (recordId: string) => {
    if (allMode) return
    if (singleRecordOnly) {
      setSelectedRecordIds((prev) => (prev.has(recordId) ? new Set() : new Set([recordId])))
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
    if (singleRecordOnly) return
    setAllMode((v) => !v)
    setSelectedRecordIds(new Set())
  }

  // Date-range validation: no future dates, and the end date can't precede the start
  const today = new Date().toLocaleDateString('en-CA')
  const dateRangeError =
    dateFrom && dateFrom > today
      ? 'Start date cannot be in the future.'
      : dateTo && dateTo > today
        ? 'End date cannot be in the future.'
        : dateFrom && dateTo && dateTo < dateFrom
          ? 'End date cannot be before the start date.'
          : null

  const effectiveCount = allMode ? eligibleRecords.length : selectedRecordIds.size
  // Pet must still be eligible — going back and changing types can invalidate an earlier pick
  const canProceedStep2 = !!selectedPetId && eligiblePetGroups.some((g) => g.petId === selectedPetId)

  // When exactly one visit is selected (typical for deep-link prefill), the type cards
  // can show visit-specific hints: no data for the type, or an exact duplicate existing
  const soleSelectedRecord =
    selectedPet && !allMode && selectedRecordIds.size === 1
      ? selectedPet.records.find((r) => selectedRecordIds.has(r._id)) ?? null
      : null

  // Shared tail for every creation path: summarize what happened and route to the
  // single created/existing report, or back to the list when several were made.
  const finishCreation = (
    created: { id: string; label: string }[],
    skipped: { id: string; label: string }[],
    failed: string[]
  ) => {
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
    }
  }

  const handleCreate = async () => {
    if (includesConfinement) {
      const stay = confinementStays.find((s) => s._id === selectedConfinementId)
      if (!stay) {
        toast.error('Select a confinement stay')
        return
      }
      setCreating(true)
      try {
        // Order the selected types by REPORT_TYPE_CONFIG; confinement always among them here.
        const orderedTypes = REPORT_TYPE_CONFIG.map((c) => c.value).filter((t) => selectedTypes.has(t))
        const created: { id: string; label: string }[] = []
        const skipped: { id: string; label: string }[] = []
        const failed: string[] = []

        for (const type of orderedTypes) {
          const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === type)?.label ?? 'Report'
          try {
            if (type === 'confinement') {
              const reportTitle = title.trim()
                ? (orderedTypes.length > 1 ? `${typeLabel}: ${title.trim()}` : title.trim())
                : `Confinement Report: ${stay.petId.name} (${fmtDate(stay.admissionDate)})`
              const report = await createVetReport(
                { petId: stay.petId._id, reportType: 'confinement', confinementRecordId: stay._id, title: reportTitle },
                token || undefined
              )
              created.push({ id: report._id, label: typeLabel })
              continue
            }

            // Non-confinement types combined with confinement are scoped to the stay's
            // own visits, filtered to whichever of those visits actually have data for the type.
            const eligibleIds = stay.medicalRecordIds.filter((rid) => {
              const rec = records.find((r) => r._id === rid)
              return !!rec && isRecordReportReady(rec) && isEligibleForType(rec, type)
            })
            if (eligibleIds.length === 0) {
              failed.push(`${typeLabel} (no eligible visits in this stay)`)
              continue
            }
            const reportTitle = title.trim()
              ? (orderedTypes.length > 1 ? `${typeLabel}: ${title.trim()}` : title.trim())
              : `${typeLabel}: ${stay.petId.name} (${fmtDate(stay.admissionDate)})`
            const report = await createVetReport(
              { petId: stay.petId._id, reportType: type, medicalRecordIds: eligibleIds, scope: 'selected', title: reportTitle },
              token || undefined
            )
            created.push({ id: report._id, label: typeLabel })
          } catch (e: any) {
            if (e instanceof DuplicateReportError) {
              skipped.push({ id: e.existingReportId, label: typeLabel })
            } else {
              failed.push(typeLabel)
              console.error(`Failed to create ${typeLabel}:`, e)
            }
          }
        }

        finishCreation(created, skipped, failed)
      } catch (e: any) {
        toast.error(e.message || 'Failed to create report')
        setCreating(false)
      }
      return
    }

    if (!selectedPet || typeList.length === 0) {
      toast.error('Select a patient and at least one report type')
      return
    }
    if (effectiveCount === 0) {
      toast.error('Select at least one medical record')
      return
    }
    if (dateRangeError) {
      toast.error(dateRangeError)
      return
    }
    setCreating(true)
    try {
      // allMode without a date range → scope 'all' (auto-updatable); otherwise explicit IDs
      const hasDateFilter = !!dateFrom || !!dateTo
      const useAllScope = allMode && !hasDateFilter

      const baseRecordIds = useAllScope
        ? undefined
        : allMode
          ? eligibleRecords.map((r) => r._id)
          : [...selectedRecordIds]

      // Create one report per selected type, in the order they appear in the config
      const orderedTypes = REPORT_TYPE_CONFIG.map((c) => c.value).filter((t) => selectedTypes.has(t))
      const created: { id: string; label: string }[] = []
      const skipped: { id: string; label: string }[] = []
      const failed: string[] = []

      for (const type of orderedTypes) {
        const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === type)?.label ?? 'Report'

        // Narrow the selection to records actually eligible for THIS type — a mixed
        // selection (e.g. a diagnostic-only visit + a surgery-only visit) must not put
        // ineligible records onto a report that isn't theirs.
        const recordIds = useAllScope
          ? undefined
          : baseRecordIds!.filter((id) => {
              const rec = selectedPet.records.find((r) => r._id === id)
              return !!rec && isEligibleForType(rec, type)
            })
        if (!useAllScope && recordIds!.length === 0) {
          failed.push(`${typeLabel} (no eligible records in selection)`)
          continue
        }

        const isConsolidated = useAllScope || (recordIds?.length ?? 0) > 1
        const singleRecord = !isConsolidated && recordIds?.length === 1
          ? selectedPet.records.find((r) => r._id === recordIds![0])
          : null
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

      finishCreation(created, skipped, failed)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create report')
      setCreating(false)
    }
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
        <div className="flex items-center gap-1 sm:gap-2 mb-8 flex-wrap">
          {stepLabels.map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <div key={label} className="flex items-center gap-1 sm:gap-2">
                <div className={`flex items-center gap-1.5 text-xs sm:text-sm font-medium ${active ? 'text-[#476B6B]' : done ? 'text-[#35785C]' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${active ? 'border-[#476B6B] bg-[#f0f7f7] text-[#476B6B]' : done ? 'border-[#35785C] bg-[#35785C] text-white' : 'border-gray-300 text-gray-400'}`}>
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
              What do you want to create?
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Select one or more; a separate document is created for each type.
            </p>
            {TYPE_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-6">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-0.5">{cat.label}</p>
                <p className="text-[11px] text-gray-400 mb-2.5">{cat.description}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REPORT_TYPE_CONFIG.filter((cfg) => cat.types.includes(cfg.value)).map((cfg) => {
                    const selected = selectedTypes.has(cfg.value)
                    const ineligibleForVisit =
                      !!soleSelectedRecord && !isEligibleForType(soleSelectedRecord, cfg.value)
                    const existsForVisit =
                      !!soleSelectedRecord &&
                      (singleRecordReportTypes[soleSelectedRecord._id] ?? []).includes(cfg.value)
                    return (
                      <button
                        key={cfg.value}
                        onClick={() => toggleType(cfg.value)}
                        disabled={ineligibleForVisit && !selected}
                        className={`text-left rounded-xl border p-4 transition-all ${
                          selected
                            ? 'border-[#7FA5A3] bg-[#f0f7f7] ring-1 ring-[#7FA5A3]'
                            : ineligibleForVisit
                              ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                              : 'border-gray-200 bg-white hover:border-[#7FA5A3] hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={selected ? 'text-[#476B6B]' : 'text-gray-400'}>
                            {REPORT_TYPE_ICONS[cfg.value]}
                          </span>
                          <span className={`font-semibold text-sm ${selected ? 'text-[#476B6B]' : 'text-gray-800'}`}>
                            {cfg.label}
                          </span>
                          <span className="ml-auto">
                            {selected
                              ? <CheckSquare className="w-4 h-4 text-[#476B6B]" />
                              : <Square className="w-4 h-4 text-gray-300" />}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">{cfg.description}</p>
                        {ineligibleForVisit && (
                          <p className="text-[10px] text-gray-400 mt-1.5">Selected visit has no data for this report type</p>
                        )}
                        {existsForVisit && !ineligibleForVisit && (
                          <p className="text-[10px] text-amber-600 mt-1.5">Already exists for the selected visit; duplicates are blocked</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {selectedTypes.size > 1 && (
              <div className="mb-4 p-3 bg-[#f0f7f7] border border-[#DCEAE3] rounded-lg text-xs text-[#476B6B]">
                {selectedTypes.size} reports will be created, one per selected type, all covering the same visits.
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={selectedTypes.size === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#476B6B] text-white text-sm font-medium hover:bg-[#3a5858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
              />
              {selectedTypes.size > 1 && title.trim() && (
                <p className="text-xs text-gray-400 mt-1">Each report&apos;s title will be prefixed with its type.</p>
              )}
            </div>

            {includesConfinement ? (
              <>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Select Confinement Stay <span className="text-gray-400 font-normal">(required)</span>
                </label>
                {typeList.length > 1 && (
                  <p className="text-xs text-gray-400 mb-3">
                    The stay&apos;s own visits will be used to scope {typeList.length - 1} other report{typeList.length - 1 !== 1 ? 's' : ''} — no separate visit selection needed.
                  </p>
                )}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by patient name…"
                    value={confinementSearch}
                    onChange={(e) => setConfinementSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>

                {confinementLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#476B6B]" />
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 mb-5">
                    {confinementStays
                      .filter((s) => !confinementSearch.trim() || s.petId?.name?.toLowerCase().includes(confinementSearch.toLowerCase()))
                      .map((s) => {
                        const isSelected = selectedConfinementId === s._id
                        const alreadyReported = usedConfinementIds.has(s._id)
                        return (
                          <button
                            key={s._id}
                            onClick={() => setSelectedConfinementId(s._id)}
                            className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                              isSelected
                                ? 'border-[#7FA5A3] bg-[#f0f7f7] ring-1 ring-[#7FA5A3]'
                                : 'border-gray-200 bg-white hover:border-[#7FA5A3]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Stethoscope className={`w-4 h-4 shrink-0 ${isSelected ? 'text-[#476B6B]' : 'text-gray-400'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">
                                  {s.petId?.name ?? 'Unknown pet'} — {s.reason}
                                </p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Admitted {fmtDate(s.admissionDate)}
                                  {s.status === 'discharged' && s.dischargeDate ? ` · Discharged ${fmtDate(s.dischargeDate)}` : ' · Currently confined'}
                                </p>
                                {alreadyReported && (
                                  <p className="text-[10px] text-amber-600 mt-1">A confinement report already exists for this stay</p>
                                )}
                              </div>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${s.status === 'discharged' ? 'bg-gray-100 text-gray-500' : 'bg-[#f0f7f7] text-[#476B6B]'}`}>
                                {s.status === 'discharged' ? 'Discharged' : 'Admitted'}
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    {confinementStays.length === 0 && (
                      <p className="text-center text-sm text-gray-400 py-8">No confinement stays found</p>
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
                    onClick={handleCreate}
                    disabled={!selectedConfinementId || creating}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#476B6B] text-white text-sm font-medium hover:bg-[#3a5858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {creating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                    ) : (
                      `Create ${typeList.length > 1 ? `${typeList.length} Reports` : 'Report'} & Open`
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
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
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                  />
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#476B6B]" />
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
                        const eligibleCount = g.records.filter((r) => isRecordReportReady(r) && isEligibleForAnyType(r, typeList)).length
                        const pendingCount = g.records.filter((r) => !isRecordReportReady(r) && isEligibleForAnyType(r, typeList)).length
                        return (
                          <button
                            key={g.petId}
                            onClick={() => selectPet(g.petId)}
                            className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                              isSelected
                                ? 'border-[#7FA5A3] bg-[#f0f7f7] ring-1 ring-[#7FA5A3]'
                                : 'border-gray-200 bg-white hover:border-[#7FA5A3]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <PawPrint className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#476B6B]' : 'text-gray-400'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm text-gray-900 truncate">{g.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {g.species === 'canine' ? 'Canine' : 'Feline'} / {g.breed}
                                </p>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0 text-right">
                                {eligibleCount} visit{eligibleCount !== 1 ? 's' : ''}
                                {pendingCount > 0 && (
                                  <span className="block text-[10px] text-amber-600">{pendingCount} pending docs</span>
                                )}
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
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#476B6B] text-white text-sm font-medium hover:bg-[#3a5858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next: Select Records <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Step 3: Records ── */}
        {step === 3 && selectedPet && (
          <div>
            <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 border border-gray-100 rounded-xl text-sm">
              <PawPrint className="w-4 h-4 text-[#5A7C7A] flex-shrink-0" />
              <span className="font-medium text-gray-900">{selectedPet.name}</span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500 text-xs">{selectedPet.species === 'canine' ? 'Canine' : 'Feline'} / {selectedPet.breed}</span>
              <span className="ml-auto text-xs text-[#476B6B]">
                {typeList.length} report{typeList.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Date range filter */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">Date Range (optional)</span>
              </div>
              <DateRangePicker
                from={dateFrom}
                to={dateTo}
                onApply={(newFrom, newTo) => {
                  setDateFrom(newFrom)
                  setDateTo(newTo)
                  setSelectedRecordIds(new Set())
                  setAllMode(false)
                }}
              />
              {dateRangeError && (
                <p className="text-xs text-[#900B09] mt-1.5">{dateRangeError}</p>
              )}
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              {singleRecordOnly ? 'Visit to include' : 'Visits to include'}
            </label>
            {singleRecordOnly && (
              <p className="text-xs text-gray-400 mb-2 -mt-1">
                Discharge summary covers exactly one visit; pick a single record.
              </p>
            )}

            {/* All-records toggle */}
            {!singleRecordOnly && (
              <button
                onClick={toggleAllMode}
                className={`w-full mb-3 rounded-lg px-4 py-3 border text-left transition-all flex items-center gap-3 ${
                  allMode
                    ? 'border-[#7FA5A3] bg-[#f0f7f7] ring-1 ring-[#7FA5A3]'
                    : 'border-gray-200 bg-white hover:border-[#7FA5A3]'
                }`}
              >
                <Layers className={`w-4 h-4 flex-shrink-0 ${allMode ? 'text-[#476B6B]' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-900">
                    {dateFrom || dateTo ? 'All records in date range' : 'All records to date'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {eligibleRecords.length} eligible visit{eligibleRecords.length !== 1 ? 's' : ''}
                    {!(dateFrom || dateTo) && !syncDisabled && ' · new visits can be folded in later'}
                  </p>
                </div>
                {allMode ? <CheckSquare className="w-4 h-4 text-[#476B6B]" /> : <Square className="w-4 h-4 text-gray-300" />}
              </button>
            )}

            {/* Record list */}
            <div className={`max-h-72 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50 mb-4 ${allMode ? 'opacity-60' : ''}`}>
              {eligibleRecords.length === 0 && pendingDocRecords.length === 0 ? (
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
                        checked ? 'border-[#7FA5A3] bg-[#f0f7f7]' : 'border-gray-200 bg-white hover:border-[#7FA5A3]'
                      } ${allMode ? 'cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-[#476B6B] flex-shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {r.chiefComplaint || 'Visit'}
                          </p>
                          {hasReport && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 mt-0.5">
                              <FileText className="w-3 h-3" /> Has existing report(s); more can be created
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
              {/* Emergency visits with deferred documentation: visible but not selectable */}
              {pendingDocRecords.map((r) => (
                <div
                  key={r._id}
                  className="w-full text-left rounded-lg px-4 py-3 border border-amber-200 bg-amber-50/60 opacity-75 cursor-not-allowed"
                >
                  <div className="flex items-center gap-3">
                    <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-gray-500 truncate">
                        {r.chiefComplaint || 'Visit'}
                      </p>
                      <p className="text-[10px] text-amber-700 mt-0.5">
                        Emergency visit with deferred documentation; complete the medical record to include it in reports
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <CalendarDays className="w-3 h-3" />
                      {fmtDate(r.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {effectiveCount > 0 && (
              <div className="mb-4 p-3 bg-[#f0f7f7] border border-[#DCEAE3] rounded-lg text-sm text-[#476B6B]">
                <strong>{selectedPet.name}</strong>: {allMode
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
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#476B6B] text-white text-sm font-medium hover:bg-[#3a5858] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

// useSearchParams requires a Suspense boundary in the App Router
export default function NewReportPage() {
  return (
    <Suspense fallback={null}>
      <NewReportContent />
    </Suspense>
  )
}
