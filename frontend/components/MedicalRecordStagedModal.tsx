'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { getRecordById, updateMedicalRecord, emptyVitals } from '@/lib/medicalRecords'
import { getPetById } from '@/lib/pets'
import { updateAppointmentStatus } from '@/lib/appointments'
import type { Medication, DiagnosticTest, PreventiveCare, Vitals } from '@/lib/medicalRecords'
import type { Pet } from '@/lib/pets'
import {
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  EyeOff,
  CheckCircle,
  Stethoscope,
  ClipboardList,
  FileCheck,
  PawPrint,
  Loader2,
  Save,
  Syringe,
  Pill,
  FlaskConical,
  Shield,
  Upload,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  recordId: string
  appointmentId: string
  petId: string
  onComplete: () => void
  onClose: () => void
}

type StepKey = 1 | 2 | 3

const STEP_LABELS: Record<StepKey, string> = {
  1: 'Pre-Procedure',
  2: 'During Procedure',
  3: 'Post-Procedure',
}

const STEP_ICONS: Record<StepKey, React.ReactNode> = {
  1: <Stethoscope className="w-4 h-4" />,
  2: <ClipboardList className="w-4 h-4" />,
  3: <FileCheck className="w-4 h-4" />,
}

const STAGE_TO_STEP: Record<string, StepKey> = {
  pre_procedure: 1,
  in_procedure: 2,
  post_procedure: 3,
  completed: 3,
}

const emptyMedication = (): Omit<Medication, '_id'> => ({
  name: '',
  dosage: '',
  route: 'oral',
  frequency: '',
  duration: '',
  startDate: null,
  endDate: null,
  notes: '',
  status: 'active',
})

const emptyDiagnosticTest = (): Omit<DiagnosticTest, '_id'> => ({
  testType: 'other',
  name: '',
  date: null,
  result: '',
  normalRange: '',
  notes: '',
})

const emptyPreventiveCare = (): Omit<PreventiveCare, '_id'> => ({
  careType: 'other',
  product: '',
  dateAdministered: null,
  nextDueDate: null,
  notes: '',
})

function calcAge(dob: string): string {
  const d = new Date(dob)
  const now = new Date()
  const months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
  if (months < 12) return `${months}mo`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return rem > 0 ? `${years}yr ${rem}mo` : `${years}yr`
}

export default function MedicalRecordStagedModal({ recordId, appointmentId, petId, onComplete, onClose }: Props) {
  const token = useAuthStore((s) => s.token)
  const [step, setStep] = useState<StepKey>(1)
  const [pet, setPet] = useState<Pet | null>(null)
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [vitalsOpen, setVitalsOpen] = useState(true)

  // Step 1 fields
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [vitals, setVitals] = useState<Vitals>(emptyVitals())

  // Step 2 fields
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('') // maps to overallObservation
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [vetNotes, setVetNotes] = useState('')
  const [xray, setXray] = useState(false)
  const [ultrasound, setUltrasound] = useState(false)
  const [availedProducts, setAvailedProducts] = useState(false)

  // Step 3 fields
  const [visitSummary, setVisitSummary] = useState('')
  const [medications, setMedications] = useState<Omit<Medication, '_id'>[]>([])
  const [diagnosticTests, setDiagnosticTests] = useState<Omit<DiagnosticTest, '_id'>[]>([])
  const [preventiveCare, setPreventiveCare] = useState<Omit<PreventiveCare, '_id'>[]>([])
  const [sharedWithOwner, setSharedWithOwner] = useState(false)
  const [images, setImages] = useState<{ data: string; contentType: string; description: string }[]>([])

  // Collapsible sections in step 3
  const [medsOpen, setMedsOpen] = useState(true)
  const [testsOpen, setTestsOpen] = useState(true)
  const [preventiveOpen, setPreventiveOpen] = useState(true)

  const loadData = useCallback(async () => {
    if (!token) return
    const [recordRes, petRes] = await Promise.all([
      getRecordById(recordId, token),
      getPetById(petId, token),
    ])
    if (recordRes.status === 'SUCCESS' && recordRes.data?.record) {
      const r = recordRes.data.record
      setChiefComplaint(r.chiefComplaint || '')
      setVitals(r.vitals || emptyVitals())
      setSubjective(r.subjective || r.chiefComplaint || '')
      setObjective(r.overallObservation || '')
      setAssessment(r.assessment || '')
      setPlan(r.plan || '')
      setVetNotes(r.vetNotes || '')
      setVisitSummary(r.visitSummary || '')
      setMedications((r.medications || []).map(({ _id: _, ...rest }) => rest))
      setDiagnosticTests((r.diagnosticTests || []).map(({ _id: _, ...rest }) => rest))
      setPreventiveCare((r.preventiveCare || []).map(({ _id: _, ...rest }) => rest))
      setSharedWithOwner(r.sharedWithOwner || false)
      const currentStep = STAGE_TO_STEP[r.stage] || 1
      setStep(currentStep)
    }
    if (petRes.status === 'SUCCESS' && petRes.data?.pet) {
      setPet(petRes.data.pet)
    }
  }, [recordId, petId, token])

  useEffect(() => {
    loadData()
  }, [loadData])

  const buildExtraObservation = () => {
    const extras: string[] = []
    if (xray) extras.push('X-Ray')
    if (ultrasound) extras.push('Ultrasound')
    if (availedProducts) extras.push('Availed Products')
    if (extras.length === 0) return objective
    return objective + (objective ? '\n\n' : '') + `Services availed: ${extras.join(', ')}`
  }

  const handleSaveAndClose = async () => {
    if (!token) return
    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        chiefComplaint,
        vitals,
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        vetNotes,
        visitSummary,
        medications,
        diagnosticTests,
        preventiveCare,
        sharedWithOwner,
      }, token)
      toast.success('Progress saved')
      onClose()
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleProceedStep1 = async () => {
    if (!token) return
    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        stage: 'in_procedure',
        chiefComplaint,
        vitals,
      }, token)
      setSubjective((prev) => prev || chiefComplaint)
      setStep(2)
    } catch {
      toast.error('Failed to save vitals')
    } finally {
      setSaving(false)
    }
  }

  const handleProceedStep2 = async () => {
    if (!token) return
    setSaving(true)
    try {
      await updateMedicalRecord(recordId, {
        stage: 'post_procedure',
        subjective,
        overallObservation: buildExtraObservation(),
        assessment,
        plan,
        vetNotes,
      }, token)
      setStep(3)
    } catch {
      toast.error('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteRecord = async () => {
    if (!token) return
    setCompleting(true)
    try {
      await updateMedicalRecord(recordId, {
        stage: 'completed',
        visitSummary,
        medications,
        diagnosticTests,
        preventiveCare,
        sharedWithOwner,
        images,
      }, token)
      await updateAppointmentStatus(appointmentId, 'completed', token)
      toast.success('Visit completed!')
      onComplete()
    } catch {
      toast.error('Failed to complete visit')
    } finally {
      setCompleting(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const result = ev.target?.result as string
        const base64 = result.split(',')[1]
        setImages((prev) => [...prev, { data: base64, contentType: file.type, description: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  const updateVital = (key: keyof Vitals, field: 'value' | 'notes', val: string) => {
    setVitals((prev) => ({ ...prev, [key]: { ...prev[key], [field]: val } }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#476B6B] rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#4F4F4F]">Visit Record</h2>
              {pet && (
                <p className="text-xs text-gray-500">{pet.name} · {pet.breed}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step progress */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            {([1, 2, 3] as StepKey[]).map((s, idx) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  s === step
                    ? 'bg-[#476B6B] text-white'
                    : s < step
                    ? 'bg-[#7FA5A3]/20 text-[#476B6B]'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {s < step ? <CheckCircle className="w-3 h-3" /> : STEP_ICONS[s]}
                  <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
                  <span className="sm:hidden">{s}</span>
                </div>
                {idx < 2 && (
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── STEP 1: PRE-PROCEDURE ── */}
          {step === 1 && (
            <>
              {/* Pet identification */}
              {pet && (
                <div className="bg-[#f0f7f7] rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <PawPrint className="w-4 h-4 text-[#476B6B]" />
                    <span className="text-sm font-semibold text-[#476B6B]">Patient Identification</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Name</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.name}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Species</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.species}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Breed</p>
                      <p className="font-medium text-[#4F4F4F]">{pet.breed}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Age</p>
                      <p className="font-medium text-[#4F4F4F]">{calcAge(pet.dateOfBirth)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs mb-0.5">Sex</p>
                      <p className="font-medium text-[#4F4F4F] capitalize">{pet.sex}</p>
                    </div>
                    {pet.microchipNumber && (
                      <div>
                        <p className="text-gray-400 text-xs mb-0.5">Microchip</p>
                        <p className="font-medium text-[#4F4F4F] text-xs">{pet.microchipNumber}</p>
                      </div>
                    )}
                  </div>
                  {pet.allergies && pet.allergies.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#7FA5A3]/20">
                      <p className="text-gray-400 text-xs mb-1.5 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        Allergies
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {pet.allergies.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chief complaint */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">
                  Chief Complaint / Reason for Visit
                </label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                  placeholder="Describe the owner's complaint and reason for today's visit…"
                />
              </div>

              {/* Vitals */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setVitalsOpen(!vitalsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#7FA5A3]" />
                    Vitals
                  </span>
                  {vitalsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {vitalsOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                    {([
                      { key: 'weight' as const, label: 'Weight', unit: 'kg' },
                      { key: 'temperature' as const, label: 'Temperature', unit: '°C' },
                      { key: 'pulseRate' as const, label: 'Pulse Rate', unit: 'bpm' },
                      { key: 'spo2' as const, label: 'SpO₂', unit: '%' },
                      { key: 'bodyConditionScore' as const, label: 'Body Condition Score', unit: '/9' },
                      { key: 'dentalScore' as const, label: 'Dental Score', unit: '/4' },
                      { key: 'crt' as const, label: 'CRT', unit: 'sec' },
                    ] as const).map(({ key, label, unit }) => (
                      <div key={key} className="grid grid-cols-2 gap-2 pt-3 first:pt-0 border-t border-gray-50 first:border-0">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">{label} <span className="text-gray-300">({unit})</span></label>
                          <input
                            type="text"
                            value={String(vitals[key]?.value ?? '')}
                            onChange={(e) => updateVital(key, 'value', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            placeholder={unit}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Notes</label>
                          <input
                            type="text"
                            value={vitals[key]?.notes ?? ''}
                            onChange={(e) => updateVital(key, 'notes', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    ))}
                    {/* Checkboxes */}
                    <div className="flex gap-4 pt-3 border-t border-gray-50">
                      {([
                        { key: 'pregnancy' as const, label: 'Pregnancy' },
                        { key: 'vaccinated' as const, label: 'Vaccinated' },
                      ] as const).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={vitals[key]?.value === 'yes'}
                            onChange={(e) => updateVital(key, 'value', e.target.checked ? 'yes' : 'no')}
                            className="w-4 h-4 accent-[#476B6B]"
                          />
                          <span className="text-sm text-gray-600">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── STEP 2: DURING PROCEDURE ── */}
          {step === 2 && (
            <>
              {/* Vitals summary (collapsible) */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setVitalsOpen(!vitalsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    Vitals Summary
                  </span>
                  {vitalsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {vitalsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                      {([
                        { key: 'weight' as const, label: 'Weight', unit: 'kg' },
                        { key: 'temperature' as const, label: 'Temp', unit: '°C' },
                        { key: 'pulseRate' as const, label: 'Pulse', unit: 'bpm' },
                        { key: 'spo2' as const, label: 'SpO₂', unit: '%' },
                      ] as const).map(({ key, label, unit }) => (
                        <div key={key} className="bg-white rounded-xl p-2 text-center">
                          <p className="text-xs text-gray-400">{label}</p>
                          <p className="text-sm font-semibold text-[#4F4F4F]">
                            {vitals[key]?.value ? `${vitals[key].value} ${unit}` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SOAP Notes */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardList className="w-4 h-4 text-[#476B6B]" />
                  <h3 className="text-sm font-semibold text-[#4F4F4F]">SOAP Notes</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      S — Subjective <span className="font-normal text-gray-400">(Patient history / owner complaint)</span>
                    </label>
                    <textarea
                      value={subjective}
                      onChange={(e) => setSubjective(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Owner's description, patient history, presenting complaint…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      O — Objective <span className="font-normal text-gray-400">(Physical examination findings)</span>
                    </label>
                    <textarea
                      value={objective}
                      onChange={(e) => setObjective(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Physical exam findings, measurable observations, test results…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      A — Assessment <span className="font-normal text-gray-400">(Diagnosis / differential diagnosis)</span>
                    </label>
                    <textarea
                      value={assessment}
                      onChange={(e) => setAssessment(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Clinical diagnosis, differential diagnoses, clinical impression…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#476B6B] mb-1">
                      P — Plan <span className="font-normal text-gray-400">(Treatment plan / next steps)</span>
                    </label>
                    <textarea
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                      placeholder="Treatment plan, follow-up instructions, referrals…"
                    />
                  </div>
                </div>
              </div>

              {/* Service checkboxes */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Services Performed</p>
                <div className="flex flex-wrap gap-3">
                  {[
                    { state: xray, set: setXray, label: 'X-Ray' },
                    { state: ultrasound, set: setUltrasound, label: 'Ultrasound' },
                    { state: availedProducts, set: setAvailedProducts, label: 'Availed Products' },
                  ].map(({ state, set, label }) => (
                    <label key={label} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state}
                        onChange={(e) => set(e.target.checked)}
                        className="w-4 h-4 accent-[#476B6B]"
                      />
                      <span className="text-sm text-gray-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vet Notes */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-1 flex items-center gap-2">
                  <EyeOff className="w-4 h-4 text-gray-400" />
                  Vet Notes <span className="font-normal text-gray-400 text-xs">(private — not visible to owner)</span>
                </label>
                <textarea
                  value={vetNotes}
                  onChange={(e) => setVetNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none bg-gray-50"
                  placeholder="Private notes, reminders, follow-up instructions…"
                />
              </div>
            </>
          )}

          {/* ── STEP 3: POST-PROCEDURE ── */}
          {step === 3 && (
            <>
              {/* Visit Summary */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2">Visit Summary</label>
                <textarea
                  value={visitSummary}
                  onChange={(e) => setVisitSummary(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] resize-none"
                  placeholder="Brief summary of today's visit, key findings, outcome…"
                />
              </div>

              {/* Medications */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setMedsOpen(!medsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Pill className="w-4 h-4 text-[#7FA5A3]" />
                    Medications <span className="text-xs font-normal text-gray-400 ml-1">({medications.length})</span>
                  </span>
                  {medsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {medsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {medications.map((med, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Medication {i + 1}</span>
                          <button onClick={() => setMedications((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" placeholder="Drug name *" value={med.name} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Dosage (e.g. 10mg)" value={med.dosage} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dosage: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.route} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, route: e.target.value as Medication['route'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="oral">Oral</option>
                            <option value="topical">Topical</option>
                            <option value="injection">Injection</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Frequency (e.g. twice daily)" value={med.frequency} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Duration (e.g. 7 days)" value={med.duration} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, duration: e.target.value } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <select value={med.status} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, status: e.target.value as Medication['status'] } : m))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="discontinued">Discontinued</option>
                          </select>
                        </div>
                        <input type="text" placeholder="Notes (optional)" value={med.notes} onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, notes: e.target.value } : m))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setMedications((prev) => [...prev, emptyMedication()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Medication
                    </button>
                  </div>
                )}
              </div>

              {/* Diagnostic Tests */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setTestsOpen(!testsOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-[#7FA5A3]" />
                    Diagnostic Tests <span className="text-xs font-normal text-gray-400 ml-1">({diagnosticTests.length})</span>
                  </span>
                  {testsOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {testsOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {diagnosticTests.map((test, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Test {i + 1}</span>
                          <button onClick={() => setDiagnosticTests((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={test.testType} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, testType: e.target.value as DiagnosticTest['testType'] } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="blood_work">Blood Work</option>
                            <option value="x_ray">X-Ray</option>
                            <option value="ultrasound">Ultrasound</option>
                            <option value="urinalysis">Urinalysis</option>
                            <option value="ecg">ECG</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Test name" value={test.name} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, name: e.target.value } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="date" value={test.date || ''} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, date: e.target.value || null } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <input type="text" placeholder="Normal range" value={test.normalRange} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, normalRange: e.target.value } : t))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                        </div>
                        <textarea rows={2} placeholder="Result" value={test.result} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, result: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3] resize-none" />
                        <input type="text" placeholder="Notes (optional)" value={test.notes} onChange={(e) => setDiagnosticTests((prev) => prev.map((t, j) => j === i ? { ...t, notes: e.target.value } : t))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setDiagnosticTests((prev) => [...prev, emptyDiagnosticTest()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Test
                    </button>
                  </div>
                )}
              </div>

              {/* Preventive Care */}
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setPreventiveOpen(!preventiveOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-[#4F4F4F] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#7FA5A3]" />
                    Preventive Care <span className="text-xs font-normal text-gray-400 ml-1">({preventiveCare.length})</span>
                  </span>
                  {preventiveOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {preventiveOpen && (
                  <div className="px-4 pb-4 border-t border-gray-50 space-y-3">
                    {preventiveCare.map((care, i) => (
                      <div key={i} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-500">Item {i + 1}</span>
                          <button onClick={() => setPreventiveCare((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <select value={care.careType} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, careType: e.target.value as PreventiveCare['careType'] } : c))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]">
                            <option value="flea">Flea Prevention</option>
                            <option value="tick">Tick Prevention</option>
                            <option value="heartworm">Heartworm</option>
                            <option value="deworming">Deworming</option>
                            <option value="other">Other</option>
                          </select>
                          <input type="text" placeholder="Product name" value={care.product} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, product: e.target.value } : c))} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Date Administered</label>
                            <input type="date" value={care.dateAdministered || ''} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, dateAdministered: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Next Due Date</label>
                            <input type="date" value={care.nextDueDate || ''} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, nextDueDate: e.target.value || null } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                          </div>
                        </div>
                        <input type="text" placeholder="Notes (optional)" value={care.notes} onChange={(e) => setPreventiveCare((prev) => prev.map((c, j) => j === i ? { ...c, notes: e.target.value } : c))} className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#7FA5A3]" />
                      </div>
                    ))}
                    <button onClick={() => setPreventiveCare((prev) => [...prev, emptyPreventiveCare()])} className="flex items-center gap-1.5 text-xs text-[#476B6B] hover:text-[#3a5858] font-medium mt-1">
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                  </div>
                )}
              </div>

              {/* Image uploads */}
              <div>
                <label className="block text-sm font-semibold text-[#4F4F4F] mb-2 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#7FA5A3]" />
                  Attachments
                </label>
                <label className="flex items-center gap-2 cursor-pointer px-4 py-2 border-2 border-dashed border-gray-200 rounded-xl hover:border-[#7FA5A3] transition-colors w-fit">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Upload images</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {images.map((img, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-2 py-1">
                        <span className="text-xs text-gray-600">{img.description}</span>
                        <button onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Share with owner */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div>
                  <p className="text-sm font-semibold text-[#4F4F4F]">Share with Owner</p>
                  <p className="text-xs text-gray-500">{sharedWithOwner ? 'Owner can view this record' : 'Record is private'}</p>
                </div>
                <button
                  onClick={() => setSharedWithOwner(!sharedWithOwner)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${sharedWithOwner ? 'bg-[#476B6B]' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sharedWithOwner ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-white">
          <button
            onClick={handleSaveAndClose}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save & Close
          </button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep((s) => (s - 1) as StepKey)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Back
              </button>
            )}
            {step === 1 && (
              <button
                onClick={handleProceedStep1}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Consultation
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleProceedStep2}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Proceed to Post-Procedure
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleCompleteRecord}
                disabled={completing}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-60"
              >
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Complete Record & Finish Visit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
