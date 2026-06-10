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
  formatReportDate,
  SECTION_LABELS,
  SECTION_KEYS,
  type VetReport,
  type VetReportSections,
  type OwnerSummary,
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
        <span className="text-xs text-indigo-400 ml-auto">GPT-4o mini</span>
      </div>
      <p className="text-xs text-indigo-600 mb-3">
        Add any additional context or special notes for the AI. The medical record data will be included automatically.
      </p>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); adjustHeight() }}
        disabled={generating}
        placeholder="e.g. Focus on the cardiac findings. Include differential diagnoses. Patient is currently on enalapril from a previous visit…"
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
        Translate clinical findings into plain, compassionate language for the pet owner.
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

// ─── Report Preview (formatted document view) ────────────────────────────────

const SECTION_ICONS: Record<string, React.ReactNode> = {
  clinicalSummary:         <Stethoscope className="w-4 h-4 text-[#5A7C7A]" />,
  laboratoryInterpretation:<FlaskConical className="w-4 h-4 text-[#5A7C7A]" />,
  diagnosticIntegration:   <Activity className="w-4 h-4 text-[#5A7C7A]" />,
  assessment:              <ClipboardList className="w-4 h-4 text-[#5A7C7A]" />,
  managementPlan:          <Pill className="w-4 h-4 text-[#5A7C7A]" />,
  prognosis:               <TrendingUp className="w-4 h-4 text-[#5A7C7A]" />,
}

function PageHeader({ reportId }: { reportId: string }) {
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
  const hasOwnerSummary = ownerSummary && Object.values(ownerSummary).some(
    (v) => typeof v === 'string' && v.trim()
  )

  const calcAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
    if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
    return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
  }

  const totalPages = hasOwnerSummary ? 2 : 1

  return (
    <div className="space-y-8">

      {/* ── PAGE 1: Veterinary Diagnostic Report ── */}
      <div>
        <p className="text-xs text-gray-400 text-center mb-2">Page 1 of {totalPages} — Veterinary Diagnostic Report</p>
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ minHeight: '1056px' }}>
          <PageHeader reportId={report._id} />
          <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
            <h2 className="text-sm font-semibold tracking-wider uppercase">Veterinary Diagnostic Report</h2>
          </div>
          <div className="px-8 py-6 space-y-6">

            {/* Patient info grid */}
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

            {/* Attending vet */}
            <div className="flex items-center gap-2 bg-[#f0f7f7] rounded-xl px-4 py-3 text-sm">
              <Stethoscope className="w-4 h-4 text-[#5A7C7A] shrink-0" />
              <span className="text-xs text-gray-500 uppercase tracking-wide font-medium mr-1">Attending Veterinarian:</span>
              <span className="font-medium text-[#4F4F4F]">Dr. {vet.firstName} {vet.lastName}</span>
              {vet.prcLicenseNumber && <span className="text-gray-400 text-xs ml-1">· P.R.C. Lic No. {vet.prcLicenseNumber}</span>}
            </div>

            <hr className="border-gray-200" />

            {/* Clinical sections */}
            {SECTION_KEYS.map((key, i) => {
              const content = report.sections[key]
              if (!content?.trim()) return null
              return (
                <div key={key}>
                  {i > 0 && <hr className="border-gray-100 mb-6" />}
                  <div className="flex items-center gap-2 mb-3">
                    {SECTION_ICONS[key]}
                    <h3 className="text-sm font-semibold text-[#4F4F4F] uppercase tracking-wide">{SECTION_LABELS[key]}</h3>
                  </div>
                  <div className="bg-[#F8F6F2] rounded-xl p-4">
                    <p className="text-sm text-[#4F4F4F] whitespace-pre-wrap leading-relaxed">{content}</p>
                  </div>
                </div>
              )
            })}

            {/* Vet signature */}
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

          </div>
        </div>
      </div>

      {/* ── PAGE 2: Owner Summary (only if generated) ── */}
      {hasOwnerSummary && ownerSummary && (
        <div>
          <p className="text-xs text-gray-400 text-center mb-2">Page 2 of {totalPages} — Owner Summary</p>
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" style={{ minHeight: '1056px' }}>
            <PageHeader reportId={report._id} />
            <div className="bg-[#476B6B] text-white px-8 py-3 text-center">
              <h2 className="text-sm font-semibold tracking-wider uppercase">Owner Summary — For {pet.name}&apos;s Family</h2>
            </div>
            <div className="px-8 py-6 space-y-4">
              <p className="text-xs text-gray-500">
                A plain-language guide to this report, written for the pet owner.
              </p>
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

  // Local editable state
  const [title, setTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [contextNotes, setContextNotes] = useState('')
  const [sections, setSections] = useState<VetReportSections>({
    clinicalSummary: '',
    laboratoryInterpretation: '',
    diagnosticIntegration: '',
    assessment: '',
    managementPlan: '',
    prognosis: '',
  })

  const titleInputRef = useRef<HTMLInputElement>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const signatureCaptureRef = useRef<SignatureCaptureHandle | null>(null)

  const loadReport = useCallback(async () => {
    try {
      const r = await getVetReport(id, token || undefined)
      setReport(r)
      setTitle(r.title)
      setContextNotes(r.vetContextNotes)
      setSections(r.sections)
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

  // Auto-save sections after 2s of inactivity
  const triggerAutoSave = useCallback(
    (updatedSections: VetReportSections, notes: string) => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(async () => {
        try {
          await updateVetReport(
            id,
            { sections: updatedSections, vetContextNotes: notes },
            token || undefined
          )
        } catch {
          // silent — user can manually save
        }
      }, 2000)
    },
    [id, token]
  )

  const handleSectionChange = (key: keyof VetReportSections, value: string) => {
    const updated = { ...sections, [key]: value }
    setSections(updated)
    triggerAutoSave(updated, contextNotes)
  }

  const handleContextChange = (v: string) => {
    setContextNotes(v)
    triggerAutoSave(sections, v)
  }

  // Mutation responses from the backend are not populated (petId/vetId come back as raw IDs).
  // This helper preserves the already-populated petId and vetId from the existing state.
  const applyUpdate = (updated: VetReport) =>
    setReport((prev) => prev ? { ...updated, petId: prev.petId, vetId: prev.vetId } : updated)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateVetReport(
        id,
        { title, vetContextNotes: contextNotes, sections },
        token || undefined
      )
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
      const updated = await updateVetReport(
        id,
        { title, vetContextNotes: contextNotes, sections, status: 'finalized' },
        token || undefined
      )
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
      // continue anyway
    }
    try {
      const updated = await generateVetReport(id, token || undefined)
      applyUpdate(updated)
      setSections(updated.sections)
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
      if (updated.sharedWithOwner) {
        toast.success('Report shared with owner')
      } else {
        toast.success('Report unshared')
      }
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
      const updated = await updateVetReport(
        id,
        { vetSignature: { url, signedAt: new Date().toISOString() } },
        token || undefined
      )
      applyUpdate(updated)
      toast.success('Report signed')
      setSignModalOpen(false)
    } catch {
      toast.error('Failed to sign report')
    } finally {
      setSigning(false)
    }
  }

  const copyShareLink = () => {
    const url = `${window.location.origin}/reports/${id}`
    navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'))
  }

  const hasContent = SECTION_KEYS.some((k) => sections[k].trim().length > 0)

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

          {/* Title */}
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

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Edit / Preview toggle */}
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

              {/* Generating overlay */}
              {generating && (
                <div className="border border-indigo-100 rounded-xl p-4 bg-white min-h-[120px] flex items-center">
                  <AILoadingState />
                </div>
              )}

              {/* Owner summary section */}
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

              {/* Metadata */}
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
                  Click <strong>Generate Report</strong> to auto-fill all sections using the linked medical record,
                  or start writing manually below.
                </div>
              )}

              {SECTION_KEYS.map((key) => (
                <SectionEditor
                  key={key}
                  label={SECTION_LABELS[key]}
                  value={sections[key]}
                  onChange={(v) => handleSectionChange(key, v)}
                  disabled={generating}
                />
              ))}
            </div>
          </div>
        )}
      </div>

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
