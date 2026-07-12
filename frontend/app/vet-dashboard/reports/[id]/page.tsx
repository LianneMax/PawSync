'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  getVetReport,
  updateVetReport,
  generateVetReport,
  humanizeVetReport,
  updateVetReportOwnerSummary,
  shareVetReport,
  syncVetReportRecords,
  deleteVetReport,
  addVetReportAddendum,
  formatReportDate,
  getSectionKeys,
  getSectionLabels,
  REPORT_TYPE_CONFIG,
  REPORT_TYPE_DOCUMENT_TITLES,
  type VetReport,
  type VetReportSections,
  type OwnerSummary,
  type LinkedRecord,
  type ReportType,
  type VaccinationRecord,
  type MonitoringEntry,
} from '@/lib/vetReports'
import AILoadingState from '@/components/kokonutui/ai-loading'
import OwnerTreatmentTimeline from '@/components/OwnerTreatmentTimeline'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { authenticatedFetch } from '@/lib/auth'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import SignatureCapture, { SignatureCaptureHandle } from '@/components/SignatureCapture'
import Image from 'next/image'
import {
  ArrowLeft,
  Sparkles,
  Share2,
  CheckCircle2,
  Copy,
  PawPrint,
  RefreshCw,
  Pencil,
  X,
  Check,
  ExternalLink,
  Users,
  Search,
  Activity,
  Heart,
  FileText,
  TrendingUp,
  Stethoscope,
  FlaskConical,
  ClipboardList,
  Pill,
  PenTool,
  Layers,
  AlertTriangle,
  CalendarDays,
  Trash2,
  Scissors,
  Shield,
  Home,
  Mail,
  Tag,
  ChevronDown,
  ChevronUp,
  StickyNote,
  MessageSquarePlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { getPetNotes, savePetNotes } from '@/lib/petNotes'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionEditor({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
}) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{label}</h3>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={5}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-800 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed font-mono"
        placeholder={disabled ? 'Generate a report to fill this section…' : 'Write or edit this section…'}
      />
    </div>
  )
}

function ContextPrompt({
  value,
  onChange,
  onGenerate,
  generating,
  hasContent,
  locked = false,
}: {
  value: string
  onChange: (v: string) => void
  onGenerate: () => void
  generating: boolean
  hasContent: boolean
  locked?: boolean
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 80, maxHeight: 250 })

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-indigo-700">AI Report Generator</span>
      </div>
      <p className="text-xs text-indigo-600 mb-3">
        Add context or special notes for the AI. Medical record data is included automatically.
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); adjustHeight() }}
        disabled={generating || locked}
        placeholder="e.g. Focus on the cardiac findings. Patient is currently on enalapril…"
        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        style={{ minHeight: 80 }}
      />
      <button
        onClick={onGenerate}
        disabled={generating || locked}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {generating ? 'Generating…' : hasContent ? 'Regenerate Report' : 'Generate Report'}
      </button>
      {locked && (
        <p className="text-xs text-indigo-400 mt-2 text-center">Finalized reports can no longer be regenerated</p>
      )}
    </div>
  )
}

const OWNER_SUMMARY_CONFIG = [
  { key: 'whatWeFound' as const, label: 'What We Found', Icon: Search, bg: 'bg-blue-50', border: 'border-blue-200', ic: 'text-blue-600', tc: 'text-blue-800', ring: 'focus:ring-blue-400' },
  { key: 'testResultsExplained' as const, label: 'Test Results Explained', Icon: Activity, bg: 'bg-purple-50', border: 'border-purple-200', ic: 'text-purple-600', tc: 'text-purple-800', ring: 'focus:ring-purple-400' },
  { key: 'theDiagnosis' as const, label: 'The Diagnosis', Icon: FileText, bg: 'bg-rose-50', border: 'border-rose-200', ic: 'text-rose-600', tc: 'text-rose-800', ring: 'focus:ring-rose-400' },
  { key: 'whatsHappeningInTheirBody' as const, label: "What's Happening in Their Body", Icon: Heart, bg: 'bg-amber-50', border: 'border-amber-200', ic: 'text-amber-600', tc: 'text-amber-800', ring: 'focus:ring-amber-400' },
  { key: 'theTreatmentPlan' as const, label: 'The Treatment Plan', Icon: CheckCircle2, bg: 'bg-green-50', border: 'border-green-200', ic: 'text-green-600', tc: 'text-green-800', ring: 'focus:ring-green-400' },
  { key: 'whatToExpect' as const, label: 'What to Expect', Icon: TrendingUp, bg: 'bg-indigo-50', border: 'border-indigo-200', ic: 'text-indigo-600', tc: 'text-indigo-800', ring: 'focus:ring-indigo-400' },
]

function HumanizeSection({
  onHumanize,
  humanizing,
  hasOwnerSummary,
  disabled,
}: {
  onHumanize: () => void
  humanizing: boolean
  hasOwnerSummary: boolean
  disabled: boolean
}) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-emerald-500" />
        <span className="text-sm font-semibold text-emerald-700">Owner Summary</span>
        {hasOwnerSummary && (
          <span className="text-xs text-emerald-500 ml-auto flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Ready
          </span>
        )}
      </div>
      <p className="text-xs text-emerald-600 mb-3">
        Translate this report into plain, compassionate language for the pet owner.
      </p>
      <button
        onClick={onHumanize}
        disabled={humanizing || disabled}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {humanizing ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Translating…</>
        ) : (
          <><Users className="w-4 h-4" /> {hasOwnerSummary ? 'Regenerate Owner Summary' : 'Generate Owner Summary'}</>
        )}
      </button>
      {disabled && !humanizing && (
        <p className="text-xs text-emerald-500 mt-2 text-center">Finalize the report before generating an owner summary</p>
      )}
    </div>
  )
}

function OwnerSummaryEditor({
  summary,
  onChange,
  onTreatmentChange,
  disabled,
  saveState,
  petName,
}: {
  summary: OwnerSummary
  onChange: (key: keyof OwnerSummary, value: string) => void
  onTreatmentChange: (index: number, whatItDoes: string) => void
  disabled: boolean
  saveState: 'idle' | 'saving' | 'saved'
  petName?: string
}) {
  const treatmentItems = summary.treatmentPlan ?? []
  return (
    <details id="owner-summary-editor" className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden" open>
      <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
        <Users className="w-4 h-4 text-[#5A7C7A]" />
        <span className="text-sm font-semibold text-gray-700">
          Owner Summary{petName ? ` for ${petName}'s Family` : ''}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {saveState === 'saving' && <span className="text-[10px] text-gray-400">Saving…</span>}
          {saveState === 'saved' && <span className="text-[10px] text-gray-600 font-medium">Saved</span>}
          <ChevronDown className="details-chevron w-4 h-4 text-gray-400" />
        </span>
      </summary>
      <div className="p-4 space-y-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Review and edit the AI-drafted plain-language summary. Changes save automatically and
          appear on the owner summary page of the report.
        </p>
        {OWNER_SUMMARY_CONFIG.map(({ key, label, Icon, bg, border, ic, tc, ring }) => (
          <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
            <div className={`flex items-center gap-2 mb-2 ${tc}`}>
              <Icon className={`w-4 h-4 ${ic}`} />
              <span className="font-semibold text-sm">{label}</span>
            </div>
            <textarea
              value={summary[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
              disabled={disabled}
              rows={key === 'theTreatmentPlan' && treatmentItems.length ? 2 : 4}
              className={`w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 leading-relaxed resize-y focus:outline-none focus:ring-2 ${ring} disabled:opacity-60 disabled:cursor-not-allowed`}
              placeholder="Write this part of the owner summary…"
            />
            {/* Treatment plan renders as an editable table/timeline; the textarea above is a short intro */}
            {key === 'theTreatmentPlan' && treatmentItems.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] text-gray-500 mb-2">
                  Medications are pulled from the record — only the &ldquo;What it does&rdquo; explanation is editable.
                </p>
                <OwnerTreatmentTimeline
                  items={treatmentItems}
                  editable={!disabled}
                  onChange={onTreatmentChange}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}

// ─── Section icons ────────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  // general
  clinicalSummary:          <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  laboratoryInterpretation: <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  diagnosticIntegration:    <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  assessment:               <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  managementPlan:           <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  prognosis:                <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
  // soap
  subjective:               <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  objective:                <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  plan:                     <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  // diagnostic
  testsSummary:             <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  resultsInterpretation:    <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  clinicalCorrelation:      <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  recommendations:          <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  // surgery
  preoperativeSummary:      <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  anesthesiaProtocol:       <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  surgicalProcedure:        <Scissors className="w-4 h-4 text-[#5A7C7A]" />,
  intraoperativeMonitoring: <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  postoperativeCare:        <Heart className="w-4 h-4 text-[#5A7C7A]" />,
  complications:            <AlertTriangle className="w-4 h-4 text-[#5A7C7A]" />,
  // healthCertificate
  patientHealthStatus:      <PawPrint className="w-4 h-4 text-[#5A7C7A]" />,
  vaccinationHistory:       <Shield className="w-4 h-4 text-[#5A7C7A]" />,
  parasiteControl:          <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  travelClearance:          <CheckCircle2 className="w-4 h-4 text-[#5A7C7A]" />,
  // dischargeSummary
  diagnosisSummary:         <FileText className="w-4 h-4 text-[#5A7C7A]" />,
  medications:              <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  feedingInstructions:      <Heart className="w-4 h-4 text-[#5A7C7A]" />,
  activityRestrictions:     <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
  followUpCare:             <CalendarDays className="w-4 h-4 text-[#5A7C7A]" />,
  warningSignsToWatch:      <AlertTriangle className="w-4 h-4 text-[#5A7C7A]" />,
  // referralLetter
  referralReason:           <FileText className="w-4 h-4 text-[#5A7C7A]" />,
  clinicalHistory:          <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  currentFindings:          <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  treatmentsToDate:         <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  referralRequest:          <Mail className="w-4 h-4 text-[#5A7C7A]" />,
  // confinement
  admissionSummary:         <FileText className="w-4 h-4 text-[#5A7C7A]" />,
  monitoringTimeline:       <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  treatmentsGiven:          <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  currentStatus:            <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
}

// ─── Report Preview ───────────────────────────────────────────────────────────

function PreviewPageHeader({ reportId }: { reportId: string }) {
  return (
    <div className="relative bg-white px-8 py-5 border-b border-gray-100">
      <p className="absolute top-3 right-4 text-gray-300 text-[10px] font-mono">{reportId.slice(-8).toUpperCase()}</p>
      <div className="flex flex-col items-center text-center gap-1.5">
        <div className="relative h-14 w-64">
          <Image
            src="/images/logos/baivet-logo.png"
            alt="BaiVet Logo"
            fill
            className="object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
        <p className="text-gray-500 text-xs">134A Schirra Street, Moonwalk Village, Phase 1, Parañaque</p>
        <p className="text-gray-400 text-xs">028347477 · 0917-8220273</p>
      </div>
    </div>
  )
}

function ReportPreview({ report, ownerSummary }: { report: VetReport; ownerSummary: OwnerSummary | null }) {
  const pet = report.petId
  const vet = report.vetId
  const rType = (report.reportType ?? 'general') as ReportType
  const sectionLabels = getSectionLabels(rType)
  const sectionKeys = getSectionKeys(rType)
  const docTitle = REPORT_TYPE_DOCUMENT_TITLES[rType] ?? 'Veterinary Diagnostic Report'

  const hasOwnerSummary = ownerSummary && Object.values(ownerSummary).some(
    (v) => typeof v === 'string' && v.trim()
  )

  const visitDates = (report.medicalRecordIds ?? [])
    .filter((r): r is LinkedRecord => typeof r === 'object' && r !== null)
    .map((r) => (r.createdAt ? new Date(r.createdAt).getTime() : NaN))
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b)
  const coverage =
    visitDates.length > 1
      ? `This report covers ${visitDates.length} visits, ${formatReportDate(new Date(visitDates[0]).toISOString())} – ${formatReportDate(new Date(visitDates[visitDates.length - 1]).toISOString())}.`
      : null

  const calcAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
    if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
    return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
  }

  const totalPages = hasOwnerSummary ? 2 : 1

  const allDataRecords = ((report.medicalRecordIds ?? []).filter(
    (r): r is LinkedRecord => typeof r === 'object' && r !== null
  )).sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())

  const fmtRDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

  // Attached photos are type-specific: diagnostic images appear only on Diagnostic
  // reports, surgery images only on Surgery reports.
  const diagnosticImages = rType !== 'diagnostic' ? [] : allDataRecords.flatMap((r) =>
    (r.diagnosticTests ?? []).flatMap((t) =>
      (t.images ?? []).map((img) => ({
        url: img.url,
        description: img.description,
        label: t.name || t.testType,
        date: r.createdAt,
      }))
    )
  )
  const surgeryImages = rType !== 'surgery' ? [] : allDataRecords.flatMap((r) =>
    (r.surgeryRecord?.images ?? []).map((img) => ({
      url: img.url,
      description: img.description,
      label: r.surgeryRecord?.surgeryType || 'Surgery',
      date: r.createdAt,
    }))
  )

  type DataType = 'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery' | 'immunityTesting' | 'vaccinations'

  const SECTION_DATA_MAP: Record<string, Array<DataType>> = {
    clinicalSummary: ['vitals'],
    laboratoryInterpretation: ['diagnostics', 'immunityTesting'],
    diagnosticIntegration: ['vitals', 'diagnostics', 'immunityTesting'],
    managementPlan: ['medications', 'preventiveCare', 'vaccinations'],
    objective: ['vitals', 'diagnostics', 'immunityTesting'],
    plan: ['medications'],
    testsSummary: ['diagnostics', 'immunityTesting'],
    resultsInterpretation: ['diagnostics', 'immunityTesting'],
    clinicalCorrelation: ['vitals'],
    preoperativeSummary: ['vitals'],
    anesthesiaProtocol: ['medications'],
    surgicalProcedure: ['surgery'],
    postoperativeCare: ['medications', 'preventiveCare'],
    // Health certificate intentionally has NO vitals table
    parasiteControl: ['preventiveCare'],
    vaccinationHistory: ['vaccinations'],
    diagnosisSummary: ['vitals'],
    medications: ['medications'],
    currentFindings: ['vitals', 'diagnostics', 'immunityTesting'],
    treatmentsToDate: ['medications', 'preventiveCare'],
    clinicalHistory: ['vitals', 'diagnostics', 'medications', 'preventiveCare', 'surgery', 'immunityTesting', 'vaccinations'],
    // confinement
    admissionSummary: ['vitals'],
    treatmentsGiven: ['medications', 'preventiveCare'],
  }

  const exclusiveSectionData: Record<string, DataType[]> = (() => {
    const seen = new Set<DataType>()
    const result: Record<string, DataType[]> = {}
    for (const key of sectionKeys) {
      const cols = SECTION_DATA_MAP[key] ?? []
      const exclusive = cols.filter(t => !seen.has(t))
      exclusive.forEach(t => seen.add(t))
      result[key] = exclusive
    }
    return result
  })()

  const renderClinicalTables = (
    dataTypes: Array<DataType>,
    records: LinkedRecord[]
  ) => {
    const reportVaccinations: VaccinationRecord[] = report.vaccinations ?? []
    const hasVitals = dataTypes.includes('vitals') && records.some(r =>
      r.vitals && Object.values(r.vitals).some(v => v?.value !== '' && v?.value !== null && v?.value !== undefined)
    )
    const hasDiagnostics = dataTypes.includes('diagnostics') && records.some(r => (r.diagnosticTests?.length ?? 0) > 0)
    const hasMedications = dataTypes.includes('medications') && records.some(r => (r.medications?.length ?? 0) > 0)
    const hasPreventive = dataTypes.includes('preventiveCare') && records.some(r => (r.preventiveCare?.length ?? 0) > 0)
    const hasSurgery = dataTypes.includes('surgery') && records.some(r => !!r.surgeryRecord?.surgeryType)
    const hasImmunityTesting = dataTypes.includes('immunityTesting') && records.some(r =>
      (r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0) ||
      (r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0)
    )
    const hasVaccinations = dataTypes.includes('vaccinations') && reportVaccinations.length > 0
    if (!hasVitals && !hasDiagnostics && !hasMedications && !hasPreventive && !hasSurgery && !hasImmunityTesting && !hasVaccinations) return null

    const vitalsRecs = hasVitals ? records.filter(r =>
      r.vitals && Object.values(r.vitals).some(v => v?.value !== '' && v?.value !== null && v?.value !== undefined)
    ) : []
    const diagRecs = hasDiagnostics ? records.filter(r => (r.diagnosticTests?.length ?? 0) > 0) : []
    const medRecs = hasMedications ? records.filter(r => (r.medications?.length ?? 0) > 0) : []
    const prevRecs = hasPreventive ? records.filter(r => (r.preventiveCare?.length ?? 0) > 0) : []
    const surgRecs = hasSurgery ? records.filter(r => !!r.surgeryRecord?.surgeryType) : []

    return (
      <div className="space-y-4">
        {hasVitals && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Vitals</p>
            {vitalsRecs.length > 1 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-[#f0f7f7]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Parameter</th>
                      {vitalsRecs.map(r => (
                        <th key={r._id} className="px-3 py-2 text-left font-semibold text-[#476B6B]">{fmtRDate(r.createdAt)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(VITAL_LABELS).map(([vkey, { label, unit }]) => {
                      const anyHas = vitalsRecs.some(r => { const v = r.vitals?.[vkey]; return v?.value !== '' && v?.value !== null && v?.value !== undefined })
                      if (!anyHas) return null
                      return (
                        <tr key={vkey} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{label} ({unit})</td>
                          {vitalsRecs.map(r => {
                            const v = r.vitals?.[vkey]
                            const ok = v?.value !== '' && v?.value !== null && v?.value !== undefined
                            return <td key={r._id} className="px-3 py-2 text-gray-600">{ok ? `${v!.value} ${unit}` : 'N/A'}</td>
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {Object.entries(VITAL_LABELS).map(([vkey, { label, unit }]) => {
                  const v = vitalsRecs[0]?.vitals?.[vkey]
                  if (!v?.value && v?.value !== 0) return null
                  return (
                    <div key={vkey} className="bg-[#F8F6F2] rounded-lg p-2">
                      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
                      <p className="text-sm font-semibold text-[#4F4F4F]">{v.value} {unit}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {hasDiagnostics && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Diagnostic Test Results</p>
            {diagRecs.map(r => (
              <div key={r._id} className="mb-3 last:mb-0">
                {diagRecs.length > 1 && (
                  <p className="text-xs text-gray-400 mb-1.5">{fmtRDate(r.createdAt)}{r.chiefComplaint ? ` · ${r.chiefComplaint}` : ''}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-[#f0f7f7]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Test</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Result</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Normal Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.diagnosticTests!.map((t, ti) => (
                        <tr key={ti} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{t.name}</td>
                          <td className="px-3 py-2 text-gray-600">{t.result || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-400">{t.normalRange || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasMedications && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Medications</p>
            {medRecs.map(r => (
              <div key={r._id} className="mb-3 last:mb-0">
                {medRecs.length > 1 && (
                  <p className="text-xs text-gray-400 mb-1.5">{fmtRDate(r.createdAt)}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-[#f0f7f7]">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Medication</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Dosage · Route</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Frequency</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Duration</th>
                        <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Notes / Indication</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.medications!.map((m, mi) => (
                        <tr key={mi} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{m.name}</td>
                          <td className="px-3 py-2 text-gray-600">{m.dosage} · {m.route}</td>
                          <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                          <td className="px-3 py-2 text-gray-400">{m.duration || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-400">{m.notes || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {hasPreventive && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Preventive Care</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#f0f7f7]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Service</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Product</th>
                    {prevRecs.length > 1 && <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Visit</th>}
                  </tr>
                </thead>
                <tbody>
                  {prevRecs.flatMap(r =>
                    r.preventiveCare!.map((p, pi) => (
                      <tr key={`${r._id}-${pi}`} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-[#4F4F4F] capitalize">{p.careType}</td>
                        <td className="px-3 py-2 text-gray-600">{p.product}</td>
                        {prevRecs.length > 1 && <td className="px-3 py-2 text-gray-400">{fmtRDate(r.createdAt)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasSurgery && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Surgery Record</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#f0f7f7]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Procedure</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {surgRecs.map(r => (
                    <tr key={r._id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-[#4F4F4F]">{r.surgeryRecord!.surgeryType}</td>
                      <td className="px-3 py-2 text-gray-600">{fmtRDate(r.createdAt)}</td>
                      <td className="px-3 py-2 text-gray-400">{r.surgeryRecord!.vetRemarks || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {hasImmunityTesting && records
          .filter(r =>
            (r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0) ||
            (r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0)
          )
          .map(r => (
            <div key={r._id} className="space-y-3">
              {r.immunityTesting?.enabled && (r.immunityTesting.rows?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-1">
                    Immunity / Titer Testing
                    {r.immunityTesting.kitName && <span className="font-normal normal-case text-gray-400"> · {r.immunityTesting.kitName}</span>}
                    {r.immunityTesting.testDate && <span className="font-normal normal-case text-gray-400"> ({fmtRDate(r.immunityTesting.testDate)})</span>}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                      <thead className="bg-[#f0f7f7]">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Disease</th>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Score</th>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Status</th>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.immunityTesting.rows!.map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-[#4F4F4F]">{row.disease}</td>
                            <td className="px-3 py-2 text-gray-600">{row.score ?? 'N/A'}</td>
                            <td className="px-3 py-2 text-gray-600">{row.status || 'N/A'}</td>
                            <td className="px-3 py-2 text-gray-400">{row.action || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {r.immunityTesting?.antigenEnabled && (r.immunityTesting.antigenRows?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-1">
                    Antigen Testing
                    {r.immunityTesting.antigenDate && <span className="font-normal normal-case text-gray-400"> ({fmtRDate(r.immunityTesting.antigenDate)})</span>}
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                      <thead className="bg-[#f0f7f7]">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Disease</th>
                          <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {r.immunityTesting.antigenRows!.map((row, ri) => (
                          <tr key={ri} className="border-t border-gray-100">
                            <td className="px-3 py-2 font-medium text-[#4F4F4F]">{row.disease}</td>
                            <td className="px-3 py-2 text-gray-600">{row.result || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        }

        {hasVaccinations && (
          <div>
            <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Vaccination History</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-[#f0f7f7]">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Vaccine</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Dose</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Date Given</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Next Due</th>
                    <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reportVaccinations.map(v => (
                    <tr key={v._id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-[#4F4F4F]">{v.vaccineName}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {v.boosterNumber > 0 ? `Booster #${v.boosterNumber}` : `Dose #${v.doseNumber}`}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{fmtRDate(v.dateAdministered)}</td>
                      <td className="px-3 py-2 text-gray-400">{fmtRDate(v.nextDueDate)}</td>
                      <td className="px-3 py-2">
                        <span className={`capitalize text-xs font-medium ${
                          v.status === 'active' ? 'text-emerald-600' :
                          v.status === 'overdue' ? 'text-red-500' :
                          v.status === 'expired' ? 'text-orange-500' :
                          'text-gray-400'
                        }`}>{v.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderMonitoringTable = (entries: MonitoringEntry[]) => {
    if (!entries.length) return null
    const metric = (m?: { value: number; unit: string } | null) =>
      m?.value !== undefined && m?.value !== null ? `${m.value} ${m.unit}` : 'N/A'
    const flagColor: Record<string, string> = {
      normal: 'text-emerald-600',
      abnormal: 'text-orange-500',
      critical: 'text-red-500',
    }
    return (
      <div>
        <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wide mb-2">Monitoring Log</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
            <thead className="bg-[#f0f7f7]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Date &amp; Time</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Temp</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Heart Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Resp. Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Weight</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">SpO2</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Pain</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Hydration</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Appetite</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Clinical Notes</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Flag</th>
                <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e._id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-[#4F4F4F] whitespace-nowrap">
                    {new Date(e.recordedAt).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-3 py-2 text-gray-600 capitalize">{e.entryType}</td>
                  <td className="px-3 py-2 text-gray-600">{metric(e.temperature)}</td>
                  <td className="px-3 py-2 text-gray-600">{metric(e.heartRate)}</td>
                  <td className="px-3 py-2 text-gray-600">{metric(e.respiratoryRate)}</td>
                  <td className="px-3 py-2 text-gray-600">{metric(e.weight)}</td>
                  <td className="px-3 py-2 text-gray-600">{metric(e.spo2)}</td>
                  <td className="px-3 py-2 text-gray-600">{e.painScore ?? 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600">{e.hydrationStatus || 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600">{e.appetite || 'N/A'}</td>
                  <td className="px-3 py-2 text-gray-600 min-w-[180px]">{e.clinicalNotes || 'N/A'}</td>
                  <td className={`px-3 py-2 font-medium capitalize ${flagColor[e.clinicalFlag] ?? 'text-gray-600'}`}>{e.clinicalFlag}</td>
                  <td className="px-3 py-2 text-gray-400">
                    {e.followUpAction}{e.followUpInHours ? ` (${e.followUpInHours}h)` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 text-center mb-2">Page 1 of {totalPages} · {docTitle}</p>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ minHeight: '1056px' }}>
          <PreviewPageHeader reportId={report._id} />
          <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
            <h2 className="text-sm font-semibold tracking-wider uppercase">{docTitle}</h2>
          </div>
          <div className="px-8 py-6 space-y-6">

            <div>
              <div className="flex items-center gap-2 mb-3">
                <PawPrint className="w-4 h-4 text-[#5A7C7A]" />
                <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Patient Information</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F8F6F2] rounded-xl p-4 text-sm">
                <div><p className="text-xs text-gray-500">Name</p><p className="font-medium text-[#4F4F4F]">{pet.name}</p></div>
                <div><p className="text-xs text-gray-500">Species</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.species === 'canine' ? 'Canine' : 'Feline'}</p></div>
                <div><p className="text-xs text-gray-500">Breed</p><p className="font-medium text-[#4F4F4F]">{pet.breed}</p></div>
                <div><p className="text-xs text-gray-500">Sex</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sex ?? 'N/A'}</p></div>
                <div><p className="text-xs text-gray-500">Age</p><p className="font-medium text-[#4F4F4F]">{pet.dateOfBirth ? calcAge(pet.dateOfBirth) : 'N/A'}</p></div>
                <div><p className="text-xs text-gray-500">Weight</p><p className="font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : 'N/A'}</p></div>
                <div><p className="text-xs text-gray-500">Sterilization</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sterilization ?? 'N/A'}</p></div>
                <div><p className="text-xs text-gray-500">Microchip</p><p className="font-medium text-[#4F4F4F] font-mono">{pet.microchipNumber || 'N/A'}</p></div>
                {pet.allergies && pet.allergies.length > 0 && (
                  <div><p className="text-xs text-gray-500">Allergies</p><p className="font-medium text-[#4F4F4F]">{pet.allergies.join(', ')}</p></div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#f0f7f7] rounded-xl px-4 py-3 text-sm flex-wrap">
              <Stethoscope className="w-4 h-4 text-[#5A7C7A] shrink-0" />
              <span className="text-xs text-gray-500 uppercase tracking-wide font-medium mr-1">Attending Veterinarian:</span>
              <span className="font-medium text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</span>
              {vet.prcLicenseNumber && <span className="text-gray-400 text-xs ml-1">· P.R.C. Lic No. {vet.prcLicenseNumber}</span>}
            </div>

            {coverage && (
              <p className="text-xs text-gray-500 bg-[#F8F6F2] rounded-xl px-4 py-2.5">{coverage}</p>
            )}

            <hr className="border-gray-200" />

            {sectionKeys.map((key, i) => {
              const content = typeof report.sections[key] === 'string' ? report.sections[key] : ''
              const dataCols = exclusiveSectionData[key]
              const tables = dataCols?.length ? renderClinicalTables(dataCols, allDataRecords) : null
              const monitoringTable = key === 'monitoringTimeline' ? renderMonitoringTable(report.monitoringEntries ?? []) : null
              if (!content.trim() && !tables && !monitoringTable) return null
              return (
                <div key={key}>
                  {i > 0 && <hr className="border-gray-100 mb-6" />}
                  <div className="flex items-center gap-2 mb-3">
                    {SECTION_ICONS[key] ?? <FileText className="w-4 h-4 text-[#5A7C7A]" />}
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">{sectionLabels[key]}</h3>
                  </div>
                  {content.trim() && (
                    <div className="bg-[#F8F6F2] rounded-xl p-4 mb-4">
                      <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{content}</p>
                    </div>
                  )}
                  {tables}
                  {monitoringTable}
                </div>
              )
            })}

            {/* Attached images from diagnostics & surgery */}
            {(diagnosticImages.length > 0 || surgeryImages.length > 0) && (
              <div>
                <hr className="border-gray-100 mb-6" />
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className="w-4 h-4 text-[#5A7C7A]" />
                  <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">Attached Images</h3>
                </div>
                {diagnosticImages.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Diagnostic Images</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {diagnosticImages.map((img, i) => (
                        <figure key={`diag-${i}`} className="bg-[#F8F6F2] rounded-xl overflow-hidden border border-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.description || img.label} className="w-full h-36 object-cover" />
                          <figcaption className="px-2.5 py-1.5 text-[10px] text-gray-500">
                            <span className="font-semibold text-gray-600">{img.label}</span>
                            {img.date && <> · {fmtRDate(img.date)}</>}
                            {img.description && <span className="block text-gray-400">{img.description}</span>}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
                {surgeryImages.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 mb-2">Surgery Images</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {surgeryImages.map((img, i) => (
                        <figure key={`surg-${i}`} className="bg-[#F8F6F2] rounded-xl overflow-hidden border border-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.description || img.label} className="w-full h-36 object-cover" />
                          <figcaption className="px-2.5 py-1.5 text-[10px] text-gray-500">
                            <span className="font-semibold text-gray-600">{img.label}</span>
                            {img.date && <> · {fmtRDate(img.date)}</>}
                            {img.description && <span className="block text-gray-400">{img.description}</span>}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <hr className="border-gray-200" />
            <div className="flex items-end justify-between gap-4 flex-wrap pt-2">
              <div className="text-sm">
                {report.vetSignature?.url ? (
                  <img src={report.vetSignature.url} alt="Veterinarian signature" className="h-12 mb-1 object-contain" />
                ) : (
                  <div className="mb-6 h-8" />
                )}
                <p className="font-bold text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</p>
                <p className="text-gray-500 text-xs">Licensed Veterinarian</p>
                {vet.prcLicenseNumber && <p className="text-gray-400 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>}
                {report.vetSignature?.signedAt && <p className="text-gray-400 text-xs mt-0.5">Signed on {formatReportDate(report.vetSignature.signedAt)}</p>}
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Report Date: {formatReportDate(report.reportDate)}</p>
                <p className="font-mono">{report._id.slice(-8).toUpperCase()}</p>
              </div>
            </div>

            {report.addenda && report.addenda.length > 0 && (
              <details className="report-addenda-details" open>
                <summary className="cursor-pointer">
                  <hr className="border-gray-100 mb-6" />
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquarePlus className="w-4 h-4 text-[#5A7C7A]" />
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">
                      Addenda ({report.addenda.length})
                    </h3>
                    <ChevronDown className="details-chevron w-4 h-4 text-gray-400 ml-auto" />
                  </div>
                </summary>
                <div className="space-y-3">
                  {report.addenda.map((a) => {
                    const author = typeof a.addedBy === 'object' ? a.addedBy : null
                    return (
                      <div key={a._id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{a.text}</p>
                        <p className="text-xs text-amber-700 mt-2">
                          Added {formatReportDate(a.addedAt)}{author ? ` by Dr. ${author.firstName} ${author.lastName}` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}

            <p className="text-xs text-gray-400 leading-relaxed border-t border-gray-100 pt-4">
              {report.isAIGenerated && (
                <>This report was drafted with AI assistance and has been reviewed, edited, and approved in full by Dr. {vet.firstName} {vet.lastName}. </>
              )}
              Diagnostic interpretations reflect a range of potential findings based on the results obtained, individual patient characteristics, and clinical history, and should be considered as part of a comprehensive assessment.
              {report.isAIGenerated && ' Pet owners are welcome to seek a second opinion from another licensed veterinarian.'}
            </p>
          </div>
        </div>
      </div>

      {hasOwnerSummary && ownerSummary && (
        <div>
          <p className="text-xs text-gray-400 text-center mb-2">Page 2 of {totalPages} · Owner Summary</p>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ minHeight: '1056px' }}>
            <PreviewPageHeader reportId={report._id} />
            <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
              <h2 className="text-sm font-semibold tracking-wider uppercase">Owner Summary for {pet.name}&apos;s Family</h2>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-xs text-gray-500">A plain-language guide to this report, written for the pet owner.</p>
              {OWNER_SUMMARY_CONFIG.map(({ key, label, Icon, bg, border, ic, tc }) => {
                const content = ownerSummary[key]
                const treatmentItems = key === 'theTreatmentPlan' ? (ownerSummary.treatmentPlan ?? []) : []
                if (!content?.trim() && treatmentItems.length === 0) return null
                return (
                  <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
                    <div className={`flex items-center gap-2 mb-2 ${tc}`}>
                      <Icon className={`w-4 h-4 ${ic}`} />
                      <span className="font-semibold text-sm">{label}</span>
                    </div>
                    {content?.trim() && <p className="text-sm text-gray-700 leading-relaxed">{content}</p>}
                    {treatmentItems.length > 0 && (
                      <div className={content?.trim() ? 'mt-3' : ''}>
                        <OwnerTreatmentTimeline items={treatmentItems} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Clinical Data Panel ─────────────────────────────────────────────────────

const VITAL_LABELS: Record<string, { label: string; unit: string }> = {
  weight: { label: 'Weight', unit: 'kg' },
  temperature: { label: 'Temperature', unit: '°C' },
  pulseRate: { label: 'Pulse Rate', unit: 'bpm' },
  spo2: { label: 'SpO2', unit: '%' },
  bodyConditionScore: { label: 'BCS', unit: '/5' },
  dentalScore: { label: 'Dental Score', unit: '/3' },
  crt: { label: 'CRT', unit: 'sec' },
}

function VetNotesPanel({ petId, token }: { petId: string; token?: string }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [updatedBy, setUpdatedBy] = useState<{ firstName: string; lastName: string } | null>(null)

  useEffect(() => {
    if (!petId) return
    getPetNotes(petId, token)
      .then((res) => {
        if (res.status === 'SUCCESS') {
          setNotes(res.data?.notes || '')
          setUpdatedAt(res.data?.updatedAt ?? null)
          setUpdatedBy(res.data?.updatedBy ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [petId, token])

  const handleSave = async () => {
    if (!petId) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await savePetNotes(petId, notes, token)
      if (res.status === 'SUCCESS') {
        setSaved(true)
        setUpdatedAt(res.data?.updatedAt ?? new Date().toISOString())
        setUpdatedBy(res.data?.updatedBy ?? null)
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast.error(res.message || 'Failed to save notes')
      }
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const lastUpdatedLabel = updatedAt
    ? `Last updated ${new Date(updatedAt).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })}${updatedBy ? ` by Dr. ${updatedBy.firstName} ${updatedBy.lastName}` : ''}`
    : null

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <StickyNote className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Vet Notes</span>
        {loaded && notes.trim() && !open && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">has notes</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {saving && <span className="text-[10px] text-gray-400">Saving…</span>}
          {saved && !saving && <span className="text-[10px] text-green-500 font-medium">Saved</span>}
          {open ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
        </span>
      </button>
      {open && (
        <div className="p-3 space-y-2 border-t border-gray-200">
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Private notepad for this patient — same across all visits.
          </p>
          {lastUpdatedLabel && (
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <RefreshCw className="w-2.5 h-2.5" /> {lastUpdatedLabel}
            </p>
          )}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleSave}
            rows={6}
            placeholder="Write your notes about this patient here…"
            className="w-full text-sm text-[#4F4F4F] resize-none focus:outline-none bg-white border border-gray-200 rounded-xl p-2.5 leading-relaxed focus:ring-1 focus:ring-[#7FA5A3]"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-[#476B6B] text-white rounded-lg hover:bg-[#3a5858] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RecordDataPanel({ records, scope }: { records: LinkedRecord[]; scope?: string }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <Layers className="w-4 h-4 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Source Records</span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
          {scope === 'all' ? 'All records' : `${records.length} selected`}
        </span>
      </div>
      <p className="text-xs text-gray-400 px-4 py-2">
        {records.length} visit{records.length !== 1 ? 's' : ''} · click to expand clinical data
      </p>
      <div className="divide-y divide-gray-100">
        {records.map((r) => {
          const expanded = expandedIds.has(r._id)
          const hasVitals = r.vitals && Object.entries(r.vitals).some(([, v]) => v?.value !== '' && v?.value !== null && v?.value !== undefined)
          const hasDiagnostics = (r.diagnosticTests?.length ?? 0) > 0
          const hasMedications = (r.medications?.length ?? 0) > 0
          const hasPreventive = (r.preventiveCare?.length ?? 0) > 0
          const hasSurgery = !!r.surgeryRecord?.surgeryType
          const hasAnyData = hasVitals || hasDiagnostics || hasMedications || hasPreventive || hasSurgery || !!r.overallObservation

          return (
            <div key={r._id}>
              <button
                onClick={() => toggle(r._id)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-gray-700">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.chiefComplaint && (
                    <p className="text-xs text-gray-400 truncate mt-0.5 pl-4">{r.chiefComplaint}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {!hasAnyData && <span className="text-[10px] text-gray-300">no data</span>}
                  {expanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                </div>
              </button>

              {expanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100 bg-gray-50/40">
                  {!hasAnyData ? (
                    <p className="text-xs text-gray-400 pt-3">No structured clinical data for this visit.</p>
                  ) : (
                    <>
                      {/* Vitals */}
                      {hasVitals && (
                        <div className="pt-3">
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Vitals</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(VITAL_LABELS).map(([key, { label, unit }]) => {
                              const v = r.vitals?.[key]
                              if (!v?.value && v?.value !== 0) return null
                              return (
                                <div key={key} className="bg-white rounded-lg p-2 border border-blue-100">
                                  <p className="text-[10px] text-[#3B82F6] font-medium">{label}</p>
                                  <p className="text-sm font-semibold text-[#3B82F6]">{v.value} {unit}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Diagnostic Tests */}
                      {hasDiagnostics && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Diagnostic Tests</p>
                          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-gray-400 uppercase tracking-wide">
                                  <th className="px-3 py-2 font-medium">Test</th>
                                  <th className="px-3 py-2 font-medium">Result</th>
                                  <th className="px-3 py-2 font-medium">Normal Range</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.diagnosticTests!.map((t, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="px-3 py-2 font-medium text-[#4F4F4F]">{t.name}</td>
                                    <td className="px-3 py-2 text-gray-600">{t.result || 'N/A'}</td>
                                    <td className="px-3 py-2 text-gray-400">{t.normalRange || 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Medications */}
                      {hasMedications && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Medications</p>
                          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-gray-400 uppercase tracking-wide">
                                  <th className="px-3 py-2 font-medium">Medication</th>
                                  <th className="px-3 py-2 font-medium">Dosage · Route</th>
                                  <th className="px-3 py-2 font-medium">Frequency</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.medications!.map((m, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="px-3 py-2 font-medium text-[#4F4F4F]">{m.name}</td>
                                    <td className="px-3 py-2 text-gray-600">{m.dosage} · {m.route}</td>
                                    <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Preventive Care */}
                      {hasPreventive && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Preventive Care</p>
                          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                            <table className="w-full text-xs">
                              <thead className="bg-gray-50">
                                <tr className="text-left text-gray-400 uppercase tracking-wide">
                                  <th className="px-3 py-2 font-medium">Service</th>
                                  <th className="px-3 py-2 font-medium">Product</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.preventiveCare!.map((p, i) => (
                                  <tr key={i} className="border-t border-gray-100">
                                    <td className="px-3 py-2 font-medium text-[#4F4F4F] capitalize">{p.careType}</td>
                                    <td className="px-3 py-2 text-gray-600">{p.product}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Surgery */}
                      {hasSurgery && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Surgery</p>
                          <p className="text-xs font-medium text-[#4F4F4F]">{r.surgeryRecord!.surgeryType}</p>
                          {r.surgeryRecord!.vetRemarks && (
                            <p className="text-xs text-gray-500 mt-1">{r.surgeryRecord!.vetRemarks}</p>
                          )}
                        </div>
                      )}

                      {/* Overall Observation */}
                      {r.overallObservation && (
                        <div>
                          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Overall Observation</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{r.overallObservation}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportEditorPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, user } = useAuthStore()

  const [report, setReport] = useState<VetReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [humanizing, setHumanizing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [ownerSummary, setOwnerSummary] = useState<OwnerSummary | null>(null)
  const [summarySaveState, setSummarySaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signing, setSigning] = useState(false)
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false)
  const [unfinalizeConfirmOpen, setUnfinalizeConfirmOpen] = useState(false)
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addendumText, setAddendumText] = useState('')
  const [addingAddendum, setAddingAddendum] = useState(false)

  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [contextNotes, setContextNotes] = useState('')
  const [sections, setSections] = useState<VetReportSections>({})

  const titleInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const summarySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signatureCaptureRef = useRef<SignatureCaptureHandle | null>(null)

  const loadReport = useCallback(async () => {
    try {
      const r = await getVetReport(id, token || undefined)
      setReport(r)
      setTitle(r.title)
      setContextNotes(r.vetContextNotes)
      // Merge server sections with empty base keys for the type so all editors render
      const typeKeys = getSectionKeys(r.reportType)
      const base: VetReportSections = {}
      for (const k of typeKeys) base[k] = ''
      setSections({ ...base, ...r.sections })
      setOwnerSummary(r.ownerSummary ?? null)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { loadReport() }, [loadReport])

  useEffect(() => {
    if (!token) return
    authenticatedFetch('/users/profile', { method: 'GET' }, token)
      .then((res) => {
        if (res.status === 'SUCCESS') setSavedSignatureUrl(res.data.user.signature || null)
      })
      .catch(() => {})
  }, [token])

  // Everything auto-saves (like the medical record editor) — there is no manual Save button
  const triggerAutoSave = useCallback(
    (updatedSections: VetReportSections, notes: string, updatedTitle: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(async () => {
        try {
          await updateVetReport(
            id,
            { sections: updatedSections, vetContextNotes: notes, title: updatedTitle },
            token || undefined
          )
        } catch {
          // silent
        }
      }, 2000)
    },
    [id, token]
  )

  // Finalized reports are locked: backend rejects edits, so don't even queue autosaves
  const isFinalized = report?.status === 'finalized'

  // Owners are shown the plain-language summary first, so every text section must be
  // filled before sharing. treatmentPlan is optional (empty for medication-less reports).
  const ownerSummaryComplete = !!ownerSummary && (
    ['whatWeFound', 'testResultsExplained', 'whatsHappeningInTheirBody',
     'theDiagnosis', 'theTreatmentPlan', 'whatToExpect'] as const
  ).every((k) => {
    const v = ownerSummary[k]
    return typeof v === 'string' && v.trim().length > 0
  })

  const handleSectionChange = (key: string, value: string) => {
    if (isFinalized) return
    const updated = { ...sections, [key]: value }
    setSections(updated)
    triggerAutoSave(updated, contextNotes, title)
  }

  const handleContextChange = (v: string) => {
    if (isFinalized) return
    setContextNotes(v)
    triggerAutoSave(sections, v, title)
  }

  const handleTitleChange = (v: string) => {
    if (isFinalized) return
    setTitle(v)
    triggerAutoSave(sections, contextNotes, v)
  }

  const applyUpdate = (updated: VetReport) =>
    setReport((prev) => prev
      ? {
          ...updated,
          petId: prev.petId,
          vetId: prev.vetId,
          medicalRecordIds: prev.medicalRecordIds,
          newRecordCount: prev.newRecordCount,
          vaccinations: prev.vaccinations,
          monitoringEntries: prev.monitoringEntries,
        }
      : updated)

  // Opens the finalize confirmation after client-side validation; the backend
  // re-validates (blank / unsigned) regardless.
  const requestFinalize = () => {
    const blank = !Object.values(sections).some((v) => typeof v === 'string' && v.trim().length > 0)
    if (blank) {
      toast.error('Cannot finalize a blank report. Generate or write the report content first.')
      return
    }
    if (!report?.vetSignature?.url) {
      toast.error('Sign the report before finalizing it.')
      return
    }
    setFinalizeConfirmOpen(true)
  }

  const handleFinalize = async () => {
    setFinalizeConfirmOpen(false)
    setSaving(true)
    try {
      const updated = await updateVetReport(id, { title, vetContextNotes: contextNotes, sections, status: 'finalized' }, token || undefined)
      applyUpdate(updated)
      toast.success('Report finalized')
    } catch (e: any) {
      toast.error(e.message || 'Failed to finalize')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteVetReport(id, token || undefined)
      toast.success('Draft report deleted')
      router.push('/vet-dashboard/reports')
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete report')
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleGenerate = async () => {
    if (isFinalized) {
      toast.error('This report is finalized and can no longer be regenerated.')
      return
    }
    setGenerating(true)
    try {
      await updateVetReport(id, { vetContextNotes: contextNotes }, token || undefined)
    } catch {
      // continue
    }
    try {
      const updated = await generateVetReport(id, token || undefined)
      applyUpdate(updated)
      // Merge generated sections with base keys so all editors are present
      const typeKeys = getSectionKeys(updated.reportType)
      const base: VetReportSections = {}
      for (const k of typeKeys) base[k] = ''
      setSections({ ...base, ...updated.sections })
      setOwnerSummary(updated.ownerSummary ?? null)
      toast.success('Report generated!')
    } catch (e: any) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleHumanize = async () => {
    setHumanizing(true)
    try {
      const updated = await humanizeVetReport(id, token || undefined)
      applyUpdate(updated)
      setOwnerSummary(updated.ownerSummary ?? null)
      toast.success('Owner summary generated!')
      // The editable summary renders below the (now collapsible) report — bring it into view
      setTimeout(() => {
        document.getElementById('owner-summary-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e: any) {
      toast.error(e.message || 'Humanization failed')
    } finally {
      setHumanizing(false)
    }
  }

  // Owner summary edits auto-save like report sections, but through the dedicated
  // endpoint (summaries stay editable after finalization, unlike sections). The backend
  // keeps the treatment plan's clinical fields and only accepts whatItDoes edits.
  const scheduleSummarySave = (updated: OwnerSummary) => {
    if (summarySaveTimer.current) clearTimeout(summarySaveTimer.current)
    summarySaveTimer.current = setTimeout(async () => {
      setSummarySaveState('saving')
      try {
        await updateVetReportOwnerSummary(id, updated, token || undefined)
        setSummarySaveState('saved')
        setTimeout(() => setSummarySaveState('idle'), 2000)
      } catch (e: any) {
        setSummarySaveState('idle')
        toast.error(e.message || 'Failed to save owner summary')
      }
    }, 2000)
  }

  const handleOwnerSummaryChange = (key: keyof OwnerSummary, value: string) => {
    if (!ownerSummary) return
    const updated = { ...ownerSummary, [key]: value }
    setOwnerSummary(updated)
    scheduleSummarySave(updated)
  }

  const handleTreatmentItemChange = (index: number, whatItDoes: string) => {
    if (!ownerSummary?.treatmentPlan) return
    const nextPlan = ownerSummary.treatmentPlan.map((item, i) =>
      i === index ? { ...item, whatItDoes } : item
    )
    const updated = { ...ownerSummary, treatmentPlan: nextPlan }
    setOwnerSummary(updated)
    scheduleSummarySave(updated)
  }

  // Sharing is one-way: confirm first, and never offer an unshare path
  const requestShare = () => {
    if (!report) return
    if (report.sharedWithOwner) return
    if (report.status !== 'finalized') {
      toast.error('Finalize the report before sharing it with the owner.')
      return
    }
    // Owners see the plain-language summary first, so every section must be filled
    if (!ownerSummaryComplete) {
      toast.error('Complete every section of the owner summary before sharing the report with the owner.')
      return
    }
    setShareConfirmOpen(true)
  }

  const handleShare = async () => {
    setShareConfirmOpen(false)
    setSharing(true)
    try {
      const updated = await shareVetReport(id, true, token || undefined)
      applyUpdate(updated)
      toast.success('Report shared with owner')
    } catch (e: any) {
      toast.error(e.message || 'Failed to share report')
    } finally {
      setSharing(false)
    }
  }

  // Finalized reports can be reverted to draft only while still unshared
  const handleUnfinalize = async () => {
    setUnfinalizeConfirmOpen(false)
    setSaving(true)
    try {
      const updated = await updateVetReport(id, { status: 'draft' }, token || undefined)
      applyUpdate(updated)
      toast.success('Report reverted to draft')
    } catch (e: any) {
      toast.error(e.message || 'Failed to revert report')
    } finally {
      setSaving(false)
    }
  }

  const handleSignReport = async () => {
    const url = await signatureCaptureRef.current?.getSignatureUrl()
    if (!url) {
      toast.error('Please draw or select a signature first')
      return
    }
    setSigning(true)
    try {
      const updated = await updateVetReport(id, { vetSignature: { url, signedAt: new Date().toISOString() } }, token || undefined)
      applyUpdate(updated)
      toast.success('Report signed')
      setSignModalOpen(false)
    } catch {
      toast.error('Failed to sign report')
    } finally {
      setSigning(false)
    }
  }

  const handleUpdateRecords = async () => {
    setUpdateConfirmOpen(false)
    setUpdating(true)
    setGenerating(true)
    try {
      await updateVetReport(id, { vetContextNotes: contextNotes }, token || undefined).catch(() => {})
      const { addedCount } = await syncVetReportRecords(id, token || undefined)
      if (addedCount === 0) {
        toast.info('No new completed records found for this patient')
        await loadReport()
        return
      }
      await generateVetReport(id, token || undefined)
      await loadReport()
      toast.success(`Report updated with ${addedCount} new visit${addedCount !== 1 ? 's' : ''}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to update report')
      await loadReport()
    } finally {
      setUpdating(false)
      setGenerating(false)
    }
  }

  const copyShareLink = () => {
    const url = `${window.location.origin}/reports/${id}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'))
  }

  // Finalized reports are frozen snapshots (see the locked banner above) — a correction
  // discovered after the fact (e.g. a linked medical record edited post-share) is appended
  // here instead of touching the original content, so the signed/shared version never changes.
  const handleAddAddendum = async () => {
    if (!addendumText.trim()) return
    setAddingAddendum(true)
    try {
      const updated = await addVetReportAddendum(id, addendumText.trim(), token || undefined)
      applyUpdate(updated)
      setAddendumText('')
      toast.success('Addendum added')
    } catch (e: any) {
      toast.error(e.message || 'Failed to add addendum')
    } finally {
      setAddingAddendum(false)
    }
  }

  const rType = (report?.reportType ?? 'general') as ReportType
  const activeSectionKeys = getSectionKeys(rType)
  const activeSectionLabels = getSectionLabels(rType)
  const hasContent = activeSectionKeys.some((k) => typeof sections[k] === 'string' && sections[k].trim().length > 0)
  const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === rType)?.label ?? 'General Report'
  // Per-visit types describe exactly one visit — new records can't be folded in
  // (the backend rejects sync for these), so never offer the update banner.
  const isPerVisitType = rType === 'soap' || rType === 'surgery' || rType === 'dischargeSummary'

  if (loading) {
    return (
      <DashboardLayout userType={user?.userType as any}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </DashboardLayout>
    )
  }

  if (!report) {
    return (
      <DashboardLayout userType={user?.userType as any}>
        <div className="flex items-center justify-center min-h-[60vh] text-gray-400">Report not found</div>
      </DashboardLayout>
    )
  }

  const pet = report.petId

  const linkedRecords = ((report.medicalRecordIds ?? []).filter(
    (r) => typeof r === 'object' && r !== null
  ) as LinkedRecord[])
    .slice()
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
  const legacyRecord =
    linkedRecords.length === 0 && report.medicalRecordId && typeof report.medicalRecordId === 'object'
      ? (report.medicalRecordId as unknown as LinkedRecord)
      : null
  const sourceRecords = linkedRecords.length > 0 ? linkedRecords : legacyRecord ? [legacyRecord] : []
  const newRecordCount = report.newRecordCount ?? 0

  return (
    <DashboardLayout userType={user?.userType as any}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Top bar */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:gap-4">
          <button
            onClick={() => router.push('/vet-dashboard/reports')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Reports
          </button>

          <div className="flex-1 min-w-0">
            {editingTitle && !isFinalized ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false) }}
                  autoFocus
                  className="flex-1 text-lg font-bold border-b-2 border-indigo-400 bg-transparent focus:outline-none text-gray-900"
                />
                <button onClick={() => setEditingTitle(false)} className="text-green-600 hover:text-green-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { handleTitleChange(report.title); setEditingTitle(false) }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => { if (!isFinalized) setEditingTitle(true) }}
                className={`group flex items-center gap-2 text-left w-full ${isFinalized ? 'cursor-default' : ''}`}
              >
                <h1 className="text-lg font-bold text-gray-900 truncate">
                  {title || `Untitled Report: ${pet?.name}`}
                </h1>
                {!isFinalized && (
                  <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
              <button
                onClick={() => setView('edit')}
                className={`px-3 py-1.5 ${view === 'edit' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Edit
              </button>
              <button
                onClick={() => setView('preview')}
                className={`px-3 py-1.5 ${view === 'preview' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Preview
              </button>
            </div>

            {report.status !== 'finalized' ? (
              <button
                onClick={requestFinalize}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> {saving ? 'Finalizing…' : 'Finalize'}
              </button>
            ) : (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                  <CheckCircle2 className="w-4 h-4" /> Finalized
                </span>
                {!report.sharedWithOwner && (
                  <button
                    onClick={() => setUnfinalizeConfirmOpen(true)}
                    disabled={saving}
                    title="Revert this report to draft so it can be edited"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" /> Revert to Draft
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setSignModalOpen(true)}
              disabled={isFinalized}
              title={isFinalized ? 'Finalized reports can no longer be re-signed' : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:cursor-not-allowed ${
                report.vetSignature?.url
                  ? 'bg-[#476B6B] text-white hover:bg-[#3a5a5a] disabled:hover:bg-[#476B6B]'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <PenTool className="w-4 h-4" />
              {report.vetSignature?.url ? 'Signed' : 'Sign Report'}
            </button>

            {report.sharedWithOwner ? (
              <span
                title="Shared with the owner; sharing cannot be undone"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-[#E8F2EE] text-[#35785C] border border-[#DCEAE3]"
              >
                <Share2 className="w-4 h-4" /> Shared
              </span>
            ) : (
              <button
                onClick={requestShare}
                disabled={report.status !== 'finalized' || !ownerSummaryComplete || sharing}
                title={
                  report.status !== 'finalized'
                    ? 'Finalize the report before sharing'
                    : !ownerSummaryComplete
                      ? 'Complete every section of the owner summary before sharing'
                      : undefined
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Share2 className="w-4 h-4" />
                {sharing ? 'Sharing…' : 'Share'}
              </button>
            )}

            {report.sharedWithOwner && (
              <button
                onClick={copyShareLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                title="Copy share link"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}

            {report.status === 'draft' && !report.sharedWithOwner && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#900B09]/30 rounded-lg text-sm text-[#900B09] hover:bg-[#F4D3D2] transition-colors"
                title="Delete this draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Patient banner */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 flex-wrap">
          <PawPrint className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            <strong className="text-gray-900">{pet?.name}</strong>
            {' · '}{pet?.species === 'canine' ? 'Canine' : 'Feline'} / {pet?.breed}
            {pet?.sex && ` · ${pet.sex}`}
            {pet?.weight && ` · ${pet.weight} kg`}
          </span>
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
            <Tag className="w-3 h-3" /> {typeLabel}
          </span>
          {report.isAIGenerated && (
            <span className="sm:ml-auto text-xs text-indigo-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI-generated
            </span>
          )}
          {report.sharedWithOwner && (
            <a
              href={`/reports/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:ml-auto text-xs text-blue-500 flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> View shared
            </a>
          )}
        </div>

        {/* New-visit staleness banner — not for per-visit types or locked finalized reports */}
        {newRecordCount > 0 && !updating && !isPerVisitType && !isFinalized && (
          <div className="flex flex-col gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5 sm:mt-0" />
              <span>
                <strong>{newRecordCount} new completed visit{newRecordCount !== 1 ? 's' : ''}</strong> for {pet?.name} since this report was {report.recordsSyncedAt ? 'last updated' : 'created'}.
              </span>
            </div>
            <button
              onClick={() => setUpdateConfirmOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" /> Update Report
            </button>
          </div>
        )}

        {view === 'preview' ? (
          <ReportPreview report={{ ...report, sections, title }} ownerSummary={ownerSummary} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: AI prompt */}
            <div className="lg:col-span-1">
              <ContextPrompt
                value={contextNotes}
                onChange={handleContextChange}
                onGenerate={handleGenerate}
                generating={generating}
                hasContent={hasContent}
                locked={isFinalized}
              />

              {generating && (
                <div className="border border-indigo-100 rounded-xl p-4 bg-white min-h-[120px] flex items-center">
                  <AILoadingState />
                </div>
              )}

              {!generating && (
                <div className="mt-4">
                  <HumanizeSection
                    onHumanize={handleHumanize}
                    humanizing={humanizing}
                    hasOwnerSummary={!!ownerSummary}
                    disabled={report.status !== 'finalized'}
                  />
                  {humanizing && (
                    <div className="mt-3 border border-emerald-100 rounded-xl p-4 bg-white flex items-center">
                      <AILoadingState mode="humanize" />
                    </div>
                  )}
                </div>
              )}

              {!generating && pet?._id && (
                <VetNotesPanel petId={pet._id} token={token || undefined} />
              )}

              {!generating && sourceRecords.length > 0 && (
                <RecordDataPanel records={sourceRecords} scope={report.scope} />
              )}

              {!generating && !humanizing && (
                <div className="text-xs text-gray-400 space-y-1 mt-4">
                  <p>Report date: {formatReportDate(report.reportDate)}</p>
                  <p>Status: <span className="capitalize">{report.status}</span></p>
                  {report.sharedWithOwner && report.sharedAt && (
                    <p>Shared: {formatReportDate(report.sharedAt)}</p>
                  )}
                  <p>Last saved: {new Date(report.updatedAt).toLocaleTimeString('en-PH')}</p>
                </div>
              )}
            </div>

            {/* Right: editable sections */}
            <div className="lg:col-span-2">
              {isFinalized && (
                <div className="mb-6 p-4 bg-[#f0f7f7] border border-[#DCEAE3] rounded-xl text-sm text-[#476B6B] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  {report.sharedWithOwner
                    ? 'This report has been shared with the owner and is permanently locked.'
                    : 'This report is finalized and locked. Revert it to draft to make changes.'}
                </div>
              )}

              {isFinalized && (
                <details className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4" open>
                  <summary className="cursor-pointer flex items-center gap-2 mb-2">
                    <MessageSquarePlus className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-800">
                      Addenda{report.addenda?.length ? ` (${report.addenda.length})` : ''}
                    </span>
                    <ChevronDown className="details-chevron w-4 h-4 text-amber-500 ml-auto" />
                  </summary>
                  <p className="text-xs text-amber-700 mb-3">
                    Found something that changed since this report was finalized (e.g. a corrected
                    medical record)? Add a dated note below — it&apos;s appended to the report and
                    visible to the owner, without altering the original signed content.
                  </p>
                  {report.addenda && report.addenda.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {report.addenda.map((a) => {
                        const author = typeof a.addedBy === 'object' ? a.addedBy : null
                        return (
                          <div key={a._id} className="bg-white border border-amber-100 rounded-lg p-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.text}</p>
                            <p className="text-xs text-amber-600 mt-1.5">
                              {formatReportDate(a.addedAt)}{author ? ` · Dr. ${author.firstName} ${author.lastName}` : ''}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <textarea
                    value={addendumText}
                    onChange={(e) => setAddendumText(e.target.value)}
                    disabled={addingAddendum}
                    rows={3}
                    placeholder="e.g. Patient's weight has since been corrected to 8kg in the medical record; this report's preoperative weight of 7.5kg reflects the value at the time the surgery report was finalized."
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
                  />
                  <button
                    onClick={handleAddAddendum}
                    disabled={addingAddendum || !addendumText.trim()}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <MessageSquarePlus className="w-4 h-4" />
                    {addingAddendum ? 'Adding…' : 'Add Addendum'}
                  </button>
                </details>
              )}
              {!hasContent && !generating && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  Click <strong>Generate Report</strong> to auto-fill all sections, or start writing manually below.
                </div>
              )}

              {ownerSummary ? (
                <>
                  {/* With a summary to edit below, the vet's report collapses out of the way */}
                  <details className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden" open>
                    <summary className="cursor-pointer flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                      <FileText className="w-4 h-4 text-[#5A7C7A]" />
                      <span className="text-sm font-semibold text-gray-700">Veterinary Report</span>
                      <ChevronDown className="details-chevron w-4 h-4 text-gray-400 ml-auto" />
                    </summary>
                    <div className="p-4 border-t border-gray-200">
                      {activeSectionKeys.map((key) => (
                        <SectionEditor
                          key={key}
                          label={activeSectionLabels[key]}
                          value={typeof sections[key] === 'string' ? sections[key] : ''}
                          onChange={(v) => handleSectionChange(key, v)}
                          disabled={generating || isFinalized}
                        />
                      ))}
                    </div>
                  </details>

                  <OwnerSummaryEditor
                    summary={ownerSummary}
                    onChange={handleOwnerSummaryChange}
                    onTreatmentChange={handleTreatmentItemChange}
                    disabled={humanizing}
                    saveState={summarySaveState}
                    petName={pet?.name}
                  />
                </>
              ) : (
                activeSectionKeys.map((key) => (
                  <SectionEditor
                    key={key}
                    label={activeSectionLabels[key]}
                    value={typeof sections[key] === 'string' ? sections[key] : ''}
                    onChange={(v) => handleSectionChange(key, v)}
                    disabled={generating || isFinalized}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Finalize confirmation — finalized reports can never be deleted */}
      <Dialog open={finalizeConfirmOpen} onOpenChange={setFinalizeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Finalize Report</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              Finalizing marks this report as the official clinical document for the covered visit{(report.medicalRecordIds?.length ?? 0) > 1 ? 's' : ''}.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
              <li><strong>A finalized report can never be deleted.</strong></li>
              <li>Content is locked; you can revert to draft to edit, but only until the report is shared.</li>
              <li>It becomes eligible for sharing with the pet owner.</li>
              <li>An owner summary can be generated after finalizing.</li>
            </ul>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setFinalizeConfirmOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Finalizing…' : 'Finalize Report'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share confirmation — sharing is permanent */}
      <Dialog open={shareConfirmOpen} onOpenChange={setShareConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Share Report with Owner</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              This shares &ldquo;{title || `Untitled Report: ${pet?.name}`}&rdquo; with the pet owner. They will be
              notified by email and can view the report at any time.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
              <li><strong>This action cannot be undone.</strong> A shared report cannot be unshared.</li>
              <li>The report can no longer be reverted to draft or edited after sharing.</li>
            </ul>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShareConfirmOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="px-4 py-2 bg-[#476B6B] hover:bg-[#3a5858] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sharing ? 'Sharing…' : 'Share Permanently'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unfinalize confirmation — only offered while the report is unshared */}
      <Dialog open={unfinalizeConfirmOpen} onOpenChange={setUnfinalizeConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Revert to Draft</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>This reverts the finalized report to a draft so it can be edited again.</p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
              <li>The report must be finalized again before it can be shared.</li>
              <li>This is only possible because the report has not been shared with the owner yet.</li>
            </ul>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setUnfinalizeConfirmOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUnfinalize}
              disabled={saving}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Reverting…' : 'Revert to Draft'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-draft confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Delete Draft Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This permanently deletes the draft &ldquo;{title || `Untitled Report: ${pet?.name}`}&rdquo;. This cannot be undone.
          </p>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-[#900B09] hover:bg-[#7A0908] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting…' : 'Delete Draft'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update-report confirmation */}
      <Dialog open={updateConfirmOpen} onOpenChange={setUpdateConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Update Report with New Visits</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              This will add <strong>{newRecordCount} new completed visit{newRecordCount !== 1 ? 's' : ''}</strong> to
              this report and regenerate all sections to cover the full visit history.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs text-gray-500">
              <li>Manual edits to sections will be overwritten by the regenerated content.</li>
              {ownerSummary && <li>The owner summary will be cleared and must be regenerated.</li>}
              {report.sharedWithOwner && <li>The report stays shared; the owner will see the updated content.</li>}
            </ul>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setUpdateConfirmOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateRecords}
              disabled={updating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? 'Updating…' : 'Update & Regenerate'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={signModalOpen} onOpenChange={(open) => { setSignModalOpen(open); if (!open) signatureCaptureRef.current?.reset() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#4F4F4F]">Sign Report</DialogTitle>
          </DialogHeader>
          <SignatureCapture ref={signatureCaptureRef} savedSignatureUrl={savedSignatureUrl} />
          <DialogFooter>
            <button
              type="button"
              onClick={() => setSignModalOpen(false)}
              className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSignReport}
              disabled={signing}
              className="px-4 py-2 bg-[#476B6B] hover:bg-[#3a5a5a] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing ? 'Signing...' : 'Sign Report'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
