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
  shareVetReport,
  syncVetReportRecords,
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
} from '@/lib/vetReports'
import AILoadingState from '@/components/kokonutui/ai-loading'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
import { authenticatedFetch } from '@/lib/auth'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import SignatureCapture, { SignatureCaptureHandle } from '@/components/SignatureCapture'
import Image from 'next/image'
import {
  ArrowLeft,
  Sparkles,
  Save,
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
  Scissors,
  Shield,
  Home,
  Mail,
  Tag,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'

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
}: {
  value: string
  onChange: (v: string) => void
  onGenerate: () => void
  generating: boolean
  hasContent: boolean
}) {
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 80, maxHeight: 250 })

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-semibold text-indigo-700">AI Report Generator</span>
        <span className="text-xs text-indigo-400 ml-auto">llama-3.3-70b</span>
      </div>
      <p className="text-xs text-indigo-600 mb-3">
        Add context or special notes for the AI. Medical record data is included automatically.
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); adjustHeight() }}
        disabled={generating}
        placeholder="e.g. Focus on the cardiac findings. Patient is currently on enalapril…"
        className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
        style={{ minHeight: 80 }}
      />
      <button
        onClick={onGenerate}
        disabled={generating}
        className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {generating ? 'Generating…' : hasContent ? 'Regenerate Report' : 'Generate Report'}
      </button>
    </div>
  )
}

const OWNER_SUMMARY_CONFIG = [
  { key: 'whatWeFound' as const, label: 'What We Found', Icon: Search, bg: 'bg-blue-50', border: 'border-blue-200', ic: 'text-blue-600', tc: 'text-blue-800' },
  { key: 'testResultsExplained' as const, label: 'Test Results Explained', Icon: Activity, bg: 'bg-purple-50', border: 'border-purple-200', ic: 'text-purple-600', tc: 'text-purple-800' },
  { key: 'whatsHappeningInTheirBody' as const, label: "What's Happening in Their Body", Icon: Heart, bg: 'bg-rose-50', border: 'border-rose-200', ic: 'text-rose-600', tc: 'text-rose-800' },
  { key: 'theDiagnosis' as const, label: 'The Diagnosis', Icon: FileText, bg: 'bg-amber-50', border: 'border-amber-200', ic: 'text-amber-600', tc: 'text-amber-800' },
  { key: 'theTreatmentPlan' as const, label: 'The Treatment Plan', Icon: CheckCircle2, bg: 'bg-green-50', border: 'border-green-200', ic: 'text-green-600', tc: 'text-green-800' },
  { key: 'whatToExpect' as const, label: 'What to Expect', Icon: TrendingUp, bg: 'bg-indigo-50', border: 'border-indigo-200', ic: 'text-indigo-600', tc: 'text-indigo-800' },
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
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  const SECTION_DATA_MAP: Record<string, Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery'>> = {
    clinicalSummary: ['vitals'],
    laboratoryInterpretation: ['diagnostics'],
    diagnosticIntegration: ['vitals', 'diagnostics'],
    managementPlan: ['medications', 'preventiveCare'],
    objective: ['vitals', 'diagnostics'],
    plan: ['medications'],
    testsSummary: ['diagnostics'],
    resultsInterpretation: ['diagnostics'],
    preoperativeSummary: ['vitals'],
    anesthesiaProtocol: ['medications'],
    surgicalProcedure: ['surgery'],
    postoperativeCare: ['medications', 'preventiveCare'],
    patientHealthStatus: ['vitals'],
    parasiteControl: ['preventiveCare'],
    medications: ['medications'],
    currentFindings: ['vitals', 'diagnostics'],
    treatmentsToDate: ['medications'],
  }

  const renderClinicalTables = (
    dataTypes: Array<'vitals' | 'diagnostics' | 'medications' | 'preventiveCare' | 'surgery'>,
    records: LinkedRecord[]
  ) => {
    const hasVitals = dataTypes.includes('vitals') && records.some(r =>
      r.vitals && Object.values(r.vitals).some(v => v?.value !== '' && v?.value !== null && v?.value !== undefined)
    )
    const hasDiagnostics = dataTypes.includes('diagnostics') && records.some(r => (r.diagnosticTests?.length ?? 0) > 0)
    const hasMedications = dataTypes.includes('medications') && records.some(r => (r.medications?.length ?? 0) > 0)
    const hasPreventive = dataTypes.includes('preventiveCare') && records.some(r => (r.preventiveCare?.length ?? 0) > 0)
    const hasSurgery = dataTypes.includes('surgery') && records.some(r => !!r.surgeryRecord?.surgeryType)
    if (!hasVitals && !hasDiagnostics && !hasMedications && !hasPreventive && !hasSurgery) return null

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
                            return <td key={r._id} className="px-3 py-2 text-gray-600">{ok ? `${v!.value} ${unit}` : '—'}</td>
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
                  <p className="text-xs text-gray-400 mb-1.5">{fmtRDate(r.createdAt)}{r.chiefComplaint ? ` — ${r.chiefComplaint}` : ''}</p>
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
                          <td className="px-3 py-2 text-gray-600">{t.result || '—'}</td>
                          <td className="px-3 py-2 text-gray-400">{t.normalRange || '—'}</td>
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
                      </tr>
                    </thead>
                    <tbody>
                      {r.medications!.map((m, mi) => (
                        <tr key={mi} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-[#4F4F4F]">{m.name}</td>
                          <td className="px-3 py-2 text-gray-600">{m.dosage} · {m.route}</td>
                          <td className="px-3 py-2 text-gray-600">{m.frequency}</td>
                          <td className="px-3 py-2 text-gray-400">{m.duration || '—'}</td>
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
                      <td className="px-3 py-2 text-gray-400">{r.surgeryRecord!.vetRemarks || '—'}</td>
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-gray-400 text-center mb-2">Page 1 of {totalPages} — {docTitle}</p>
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
                <div><p className="text-xs text-gray-500">Sex</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sex ?? '—'}</p></div>
                <div><p className="text-xs text-gray-500">Age</p><p className="font-medium text-[#4F4F4F]">{pet.dateOfBirth ? calcAge(pet.dateOfBirth) : '—'}</p></div>
                <div><p className="text-xs text-gray-500">Weight</p><p className="font-medium text-[#4F4F4F]">{pet.weight ? `${pet.weight} kg` : '—'}</p></div>
                <div><p className="text-xs text-gray-500">Sterilization</p><p className="font-medium text-[#4F4F4F] capitalize">{pet.sterilization ?? '—'}</p></div>
                <div><p className="text-xs text-gray-500">Microchip</p><p className="font-medium text-[#4F4F4F] font-mono">{pet.microchipNumber || 'N/A'}</p></div>
                {pet.allergies && pet.allergies.length > 0 && (
                  <div><p className="text-xs text-gray-500">Allergies</p><p className="font-medium text-[#4F4F4F]">{pet.allergies.join(', ')}</p></div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#f0f7f7] rounded-xl px-4 py-3 text-sm">
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
              const dataCols = SECTION_DATA_MAP[key]
              const tables = dataCols ? renderClinicalTables(dataCols, allDataRecords) : null
              if (!content.trim() && !tables) return null
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
                </div>
              )
            })}

            <hr className="border-gray-200" />
            <div className="flex items-end justify-between pt-2">
              <div className="text-sm">
                {report.vetSignature?.url ? (
                  <img src={report.vetSignature.url} alt="Veterinarian signature" className="h-12 mb-1 object-contain" />
                ) : (
                  <div className="mb-6 h-8" />
                )}
                <p className="font-bold text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</p>
                <p className="text-gray-500 text-xs">Licensed Veterinarian</p>
                {vet.prcLicenseNumber && <p className="text-gray-400 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>}
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>Report Date: {formatReportDate(report.reportDate)}</p>
                <p className="font-mono">{report._id.slice(-8).toUpperCase()}</p>
              </div>
            </div>

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
          <p className="text-xs text-gray-400 text-center mb-2">Page 2 of {totalPages} — Owner Summary</p>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ minHeight: '1056px' }}>
            <PreviewPageHeader reportId={report._id} />
            <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
              <h2 className="text-sm font-semibold tracking-wider uppercase">Owner Summary — For {pet.name}&apos;s Family</h2>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-xs text-gray-500">A plain-language guide to this report, written for the pet owner.</p>
              {OWNER_SUMMARY_CONFIG.map(({ key, label, Icon, bg, border, ic, tc }) => {
                const content = ownerSummary[key]
                if (!content?.trim()) return null
                return (
                  <div key={key} className={`rounded-xl border p-4 ${bg} ${border}`}>
                    <div className={`flex items-center gap-2 mb-2 ${tc}`}>
                      <Icon className={`w-4 h-4 ${ic}`} />
                      <span className="font-semibold text-sm">{label}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{content}</p>
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
    d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

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
        {records.length} visit{records.length !== 1 ? 's' : ''} — click to expand clinical data
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
                                    <td className="px-3 py-2 text-gray-600">{t.result || '—'}</td>
                                    <td className="px-3 py-2 text-gray-400">{t.normalRange || '—'}</td>
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
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null)
  const [signModalOpen, setSignModalOpen] = useState(false)
  const [signing, setSigning] = useState(false)
  const [updateConfirmOpen, setUpdateConfirmOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [contextNotes, setContextNotes] = useState('')
  const [sections, setSections] = useState<VetReportSections>({})

  const titleInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const triggerAutoSave = useCallback(
    (updatedSections: VetReportSections, notes: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(async () => {
        try {
          await updateVetReport(id, { sections: updatedSections, vetContextNotes: notes }, token || undefined)
        } catch {
          // silent
        }
      }, 2000)
    },
    [id, token]
  )

  const handleSectionChange = (key: string, value: string) => {
    const updated = { ...sections, [key]: value }
    setSections(updated)
    triggerAutoSave(updated, contextNotes)
  }

  const handleContextChange = (v: string) => {
    setContextNotes(v)
    triggerAutoSave(sections, v)
  }

  const applyUpdate = (updated: VetReport) =>
    setReport((prev) => prev
      ? {
          ...updated,
          petId: prev.petId,
          vetId: prev.vetId,
          medicalRecordIds: prev.medicalRecordIds,
          newRecordCount: prev.newRecordCount,
        }
      : updated)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateVetReport(id, { title, vetContextNotes: contextNotes, sections }, token || undefined)
      applyUpdate(updated)
      toast.success('Report saved')
    } catch {
      toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    setSaving(true)
    try {
      const updated = await updateVetReport(id, { title, vetContextNotes: contextNotes, sections, status: 'finalized' }, token || undefined)
      applyUpdate(updated)
      toast.success('Report finalized')
    } catch {
      toast.error('Failed to finalize')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
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
    } catch (e: any) {
      toast.error(e.message || 'Humanization failed')
    } finally {
      setHumanizing(false)
    }
  }

  const handleShare = async () => {
    if (!report) return
    try {
      const updated = await shareVetReport(id, !report.sharedWithOwner, token || undefined)
      applyUpdate(updated)
      toast.success(updated.sharedWithOwner ? 'Report shared with owner' : 'Report unshared')
    } catch {
      toast.error('Failed to update share status')
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

  const rType = (report?.reportType ?? 'general') as ReportType
  const activeSectionKeys = getSectionKeys(rType)
  const activeSectionLabels = getSectionLabels(rType)
  const hasContent = activeSectionKeys.some((k) => typeof sections[k] === 'string' && sections[k].trim().length > 0)
  const typeLabel = REPORT_TYPE_CONFIG.find((c) => c.value === rType)?.label ?? 'General Report'

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
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.push('/vet-dashboard/reports')}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Reports
          </button>

          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(false) }}
                  autoFocus
                  className="flex-1 text-lg font-bold border-b-2 border-indigo-400 bg-transparent focus:outline-none text-gray-900"
                />
                <button onClick={() => setEditingTitle(false)} className="text-green-600 hover:text-green-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => { setTitle(report.title); setEditingTitle(false) }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingTitle(true)}
                className="group flex items-center gap-2 text-left w-full"
              >
                <h1 className="text-lg font-bold text-gray-900 truncate">
                  {title || `Untitled Report — ${pet?.name}`}
                </h1>
                <Pencil className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
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

            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>

            {report.status !== 'finalized' ? (
              <button
                onClick={handleFinalize}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Finalize
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm border border-emerald-200">
                <CheckCircle2 className="w-4 h-4" /> Finalized
              </span>
            )}

            <button
              onClick={() => setSignModalOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                report.vetSignature?.url
                  ? 'bg-[#476B6B] text-white hover:bg-[#3a5a5a]'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <PenTool className="w-4 h-4" />
              {report.vetSignature?.url ? 'Signed' : 'Sign Report'}
            </button>

            <button
              onClick={handleShare}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                report.sharedWithOwner
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Share2 className="w-4 h-4" />
              {report.sharedWithOwner ? 'Shared' : 'Share'}
            </button>

            {report.sharedWithOwner && (
              <button
                onClick={copyShareLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                title="Copy share link"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Patient banner */}
        <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
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
            <span className="ml-auto text-xs text-indigo-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> AI-generated
            </span>
          )}
          {report.sharedWithOwner && (
            <a
              href={`/reports/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-blue-500 flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> View shared
            </a>
          )}
        </div>

        {/* New-visit staleness banner */}
        {newRecordCount > 0 && !updating && (
          <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="flex-1">
              <strong>{newRecordCount} new completed visit{newRecordCount !== 1 ? 's' : ''}</strong> for {pet?.name} since this report was {report.recordsSyncedAt ? 'last updated' : 'created'}.
            </span>
            <button
              onClick={() => setUpdateConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors flex-shrink-0"
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
                      <AILoadingState />
                    </div>
                  )}
                </div>
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
              {!hasContent && !generating && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  Click <strong>Generate Report</strong> to auto-fill all sections, or start writing manually below.
                </div>
              )}

              {activeSectionKeys.map((key) => (
                <SectionEditor
                  key={key}
                  label={activeSectionLabels[key]}
                  value={typeof sections[key] === 'string' ? sections[key] : ''}
                  onChange={(v) => handleSectionChange(key, v)}
                  disabled={generating}
                />
              ))}
            </div>
          </div>
        )}
      </div>

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
              {report.status === 'finalized' && <li>The report will revert to draft and must be finalized again.</li>}
              {ownerSummary && <li>The owner summary will be cleared and must be regenerated.</li>}
              {report.sharedWithOwner && <li>The report stays shared — the owner will see the updated content.</li>}
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
