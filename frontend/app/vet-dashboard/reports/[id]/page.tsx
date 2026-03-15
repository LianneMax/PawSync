'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import {
  getVetReport,
  updateVetReport,
  generateVetReport,
  shareVetReport,
  formatReportDate,
  SECTION_LABELS,
  SECTION_KEYS,
  type VetReport,
  type VetReportSections,
} from '@/lib/vetReports'
import AILoadingState from '@/components/kokonutui/ai-loading'
import { useAutoResizeTextarea } from '@/hooks/use-auto-resize-textarea'
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

// ─── Report Preview (formatted document view) ────────────────────────────────

function ReportPreview({ report }: { report: VetReport }) {
  const pet = report.petId
  const vet = report.vetId

  const calcAge = (dob: string) => {
    const diff = Date.now() - new Date(dob).getTime()
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
    const months = Math.floor((diff % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44))
    if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
    if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
    return `${years} year${years !== 1 ? 's' : ''} & ${months} month${months !== 1 ? 's' : ''}`
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 font-serif text-gray-900 text-sm leading-relaxed shadow-sm">
      {/* Clinic header placeholder */}
      <div className="text-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-xl font-bold tracking-wide uppercase">Veterinary Diagnostic Report</h1>
        <p className="text-gray-500 text-xs mt-1">Date: {formatReportDate(report.reportDate)}</p>
      </div>

      {/* Patient info */}
      <div className="mb-6 space-y-1 text-sm">
        <p><strong>Patient:</strong> {pet.name}</p>
        <p><strong>Species/Breed:</strong> {pet.species === 'canine' ? 'Canine' : 'Feline'} / {pet.breed}</p>
        <p><strong>Sex/Age:</strong> {pet.sex} / {pet.dateOfBirth ? calcAge(pet.dateOfBirth) : '—'}</p>
        <p><strong>Weight:</strong> {pet.weight ?? '—'} kg</p>
        <p><strong>Sterilization:</strong> {pet.sterilization ?? '—'}</p>
        {pet.allergies && pet.allergies.length > 0 && (
          <p><strong>Known Allergies:</strong> {pet.allergies.join(', ')}</p>
        )}
      </div>

      <p className="font-bold mb-4">Veterinarian Interpretation:</p>

      {SECTION_KEYS.map((key) => {
        const content = report.sections[key]
        if (!content) return null
        return (
          <div key={key} className="mb-5">
            <h2 className="font-bold text-sm mb-2">{SECTION_LABELS[key]}</h2>
            <p className="whitespace-pre-wrap text-sm text-gray-800">{content}</p>
          </div>
        )
      })}

      {/* Vet signature */}
      <div className="mt-8 pt-4 border-t border-gray-200 text-sm">
        <p className="font-bold">
          {vet.firstName} {vet.lastName}
        </p>
        <p className="text-gray-500">Veterinarian</p>
        {vet.prcLicenseNumber && (
          <p className="text-gray-500 text-xs mt-0.5">P.R.C. Lic No. {vet.prcLicenseNumber}</p>
        )}
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
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'edit' | 'preview'>('edit')

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

  const loadReport = useCallback(async () => {
    try {
      const r = await getVetReport(id, token || undefined)
      setReport(r)
      setTitle(r.title)
      setContextNotes(r.vetContextNotes)
      setSections(r.sections)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { loadReport() }, [loadReport])

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

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateVetReport(
        id,
        { title, vetContextNotes: contextNotes, sections },
        token || undefined
      )
      setReport(updated)
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
      setReport(updated)
      toast.success('Report finalized')
    } catch {
      toast.error('Failed to finalize')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    // Save context notes first
    try {
      await updateVetReport(id, { vetContextNotes: contextNotes }, token || undefined)
    } catch {
      // continue anyway
    }
    try {
      const updated = await generateVetReport(id, token || undefined)
      setReport(updated)
      setSections(updated.sections)
      toast.success('Report generated!')
    } catch (e: any) {
      toast.error(e.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleShare = async () => {
    if (!report) return
    try {
      const updated = await shareVetReport(id, !report.sharedWithOwner, token || undefined)
      setReport(updated)
      if (updated.sharedWithOwner) {
        toast.success('Report shared with owner')
      } else {
        toast.success('Report unshared')
      }
    } catch {
      toast.error('Failed to update share status')
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
          <ReportPreview report={{ ...report, sections, title }} />
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

              {/* Metadata */}
              {!generating && (
                <div className="text-xs text-gray-400 space-y-1">
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
    </DashboardLayout>
  )
}
