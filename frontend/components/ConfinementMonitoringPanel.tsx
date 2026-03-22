'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, HeartPulse, Activity, Thermometer, Weight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  createConfinementMonitoringEntry,
  listConfinementMonitoringEntries,
  resolveConfinementMonitoringAlert,
  type ClinicalFlag,
  type FollowUpAction,
  type MonitoringEntry,
  type MonitoringEntryType,
} from '@/lib/confinementMonitoring'

type MonitoringForm = {
  entryType: MonitoringEntryType
  recordedAt: string
  temperature: string
  heartRate: string
  respiratoryRate: string
  weight: string
  hydrationStatus: string
  appetite: string
  painScore: string
  capillaryRefillTime: string
  spo2: string
  bloodGlucose: string
  bloodPressureSystolic: string
  bloodPressureDiastolic: string
  clinicalFlag: ClinicalFlag
  clinicalNotes: string
  followUpAction: FollowUpAction
  followUpInHours: string
  requiresImmediateReview: boolean
  editReason: string
}

const emptyForm = (): MonitoringForm => ({
  entryType: 'daily',
  recordedAt: '',
  temperature: '',
  heartRate: '',
  respiratoryRate: '',
  weight: '',
  hydrationStatus: '',
  appetite: '',
  painScore: '',
  capillaryRefillTime: '',
  spo2: '',
  bloodGlucose: '',
  bloodPressureSystolic: '',
  bloodPressureDiastolic: '',
  clinicalFlag: 'normal',
  clinicalNotes: '',
  followUpAction: 'watch',
  followUpInHours: '',
  requiresImmediateReview: false,
  editReason: '',
})

function toLocalDateTimeInput(date: Date): string {
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ConfinementMonitoringPanel({
  token,
  confinementRecordId,
  isActive,
}: {
  token: string
  confinementRecordId: string
  isActive: boolean
}) {
  const [entries, setEntries] = useState<MonitoringEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<MonitoringForm>(() => ({ ...emptyForm(), recordedAt: toLocalDateTimeInput(new Date()) }))

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listConfinementMonitoringEntries(confinementRecordId, token)
      if (res.status === 'SUCCESS') {
        setEntries(res.data?.entries || [])
      } else {
        toast.error(res.message || 'Failed to load confinement monitoring entries')
      }
    } catch {
      toast.error('Failed to load confinement monitoring entries')
    } finally {
      setLoading(false)
    }
  }, [confinementRecordId, token])

  useEffect(() => {
    if (!token || !confinementRecordId || !isActive) return
    fetchEntries()
  }, [token, confinementRecordId, isActive, fetchEntries])

  const trend = useMemo(() => {
    const sorted = [...entries].sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    const latest = sorted[sorted.length - 1]
    const prev = sorted[sorted.length - 2]

    const delta = (now?: number, before?: number) => {
      if (now === undefined || before === undefined) return null
      return Number((now - before).toFixed(2))
    }

    return {
      latest,
      tempDelta: delta(latest?.temperature?.value, prev?.temperature?.value),
      hrDelta: delta(latest?.heartRate?.value, prev?.heartRate?.value),
      rrDelta: delta(latest?.respiratoryRate?.value, prev?.respiratoryRate?.value),
      weightDelta: delta(latest?.weight?.value, prev?.weight?.value),
    }
  }, [entries])

  const onChange = <K extends keyof MonitoringForm>(key: K, value: MonitoringForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    const required = ['temperature', 'heartRate', 'respiratoryRate', 'weight', 'hydrationStatus', 'appetite', 'painScore', 'clinicalNotes'] as const
    for (const key of required) {
      if (!String(form[key]).trim()) {
        toast.error('Please complete all required monitoring fields')
        return
      }
    }

    if (form.clinicalFlag === 'critical' && !form.clinicalNotes.trim()) {
      toast.error('Clinical notes are required for critical entries')
      return
    }

    if (form.followUpAction === 'recheck' && !form.followUpInHours.trim()) {
      toast.error('Set follow-up hours when action is recheck')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        entryType: form.entryType,
        recordedAt: form.recordedAt ? new Date(form.recordedAt).toISOString() : undefined,
        temperature: Number(form.temperature),
        heartRate: Number(form.heartRate),
        respiratoryRate: Number(form.respiratoryRate),
        weight: Number(form.weight),
        hydrationStatus: form.hydrationStatus,
        appetite: form.appetite,
        painScore: Number(form.painScore),
        capillaryRefillTime: form.capillaryRefillTime ? Number(form.capillaryRefillTime) : undefined,
        spo2: form.spo2 ? Number(form.spo2) : undefined,
        bloodGlucose: form.bloodGlucose ? Number(form.bloodGlucose) : undefined,
        bloodPressureSystolic: form.bloodPressureSystolic ? Number(form.bloodPressureSystolic) : undefined,
        bloodPressureDiastolic: form.bloodPressureDiastolic ? Number(form.bloodPressureDiastolic) : undefined,
        clinicalFlag: form.clinicalFlag,
        clinicalNotes: form.clinicalNotes,
        followUpAction: form.followUpAction,
        followUpInHours: form.followUpInHours ? Number(form.followUpInHours) : undefined,
        requiresImmediateReview: form.requiresImmediateReview,
        editReason: form.editReason,
      }

      const res = await createConfinementMonitoringEntry(confinementRecordId, payload, token)
      if (res.status !== 'SUCCESS') {
        toast.error(res.message || 'Failed to save monitoring entry')
        return
      }

      toast.success('Confinement monitoring entry logged')
      setForm({ ...emptyForm(), recordedAt: toLocalDateTimeInput(new Date()) })
      fetchEntries()
    } catch {
      toast.error('Failed to save monitoring entry')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (entryId: string) => {
    try {
      const res = await resolveConfinementMonitoringAlert(confinementRecordId, entryId, token)
      if (res.status !== 'SUCCESS') {
        toast.error(res.message || 'Failed to resolve alert')
        return
      }
      toast.success('Monitoring alert resolved')
      fetchEntries()
    } catch {
      toast.error('Failed to resolve alert')
    }
  }

  if (!isActive) {
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <p className="text-sm text-gray-600">Monitoring is available only for active confinement records.</p>
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider flex items-center gap-2">
          <HeartPulse className="w-3.5 h-3.5" />
          Confinement Monitoring
        </h2>
        <button
          onClick={fetchEntries}
          className="inline-flex items-center gap-1 text-xs text-[#476B6B] hover:text-[#3b5959]"
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">Temp</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.temperature?.value ?? '—'} °C</p>
            <p className="text-[10px] text-gray-500">Δ {trend.tempDelta ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">Heart Rate</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.heartRate?.value ?? '—'} bpm</p>
            <p className="text-[10px] text-gray-500">Δ {trend.hrDelta ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">Respiratory</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.respiratoryRate?.value ?? '—'} /min</p>
            <p className="text-[10px] text-gray-500">Δ {trend.rrDelta ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">Weight</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.weight?.value ?? '—'} kg</p>
            <p className="text-[10px] text-gray-500">Δ {trend.weightDelta ?? '—'}</p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider mb-2">Log Entry (Daily or Spot)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <select className="border rounded-lg px-2 py-2 text-sm" value={form.entryType} onChange={(e) => onChange('entryType', e.target.value as MonitoringEntryType)}>
              <option value="daily">Daily Vitals</option>
              <option value="spot">Spot Monitoring</option>
            </select>
            <input type="datetime-local" className="border rounded-lg px-2 py-2 text-sm" value={form.recordedAt} onChange={(e) => onChange('recordedAt', e.target.value)} />
            <select className="border rounded-lg px-2 py-2 text-sm" value={form.clinicalFlag} onChange={(e) => onChange('clinicalFlag', e.target.value as ClinicalFlag)}>
              <option value="normal">Normal</option>
              <option value="abnormal">Abnormal</option>
              <option value="critical">Critical</option>
            </select>

            <input placeholder="Temperature (°C)*" className="border rounded-lg px-2 py-2 text-sm" value={form.temperature} onChange={(e) => onChange('temperature', e.target.value)} />
            <input placeholder="Heart rate (bpm)*" className="border rounded-lg px-2 py-2 text-sm" value={form.heartRate} onChange={(e) => onChange('heartRate', e.target.value)} />
            <input placeholder="Respiratory rate (/min)*" className="border rounded-lg px-2 py-2 text-sm" value={form.respiratoryRate} onChange={(e) => onChange('respiratoryRate', e.target.value)} />

            <input placeholder="Weight (kg)*" className="border rounded-lg px-2 py-2 text-sm" value={form.weight} onChange={(e) => onChange('weight', e.target.value)} />
            <input placeholder="Hydration status*" className="border rounded-lg px-2 py-2 text-sm" value={form.hydrationStatus} onChange={(e) => onChange('hydrationStatus', e.target.value)} />
            <input placeholder="Appetite*" className="border rounded-lg px-2 py-2 text-sm" value={form.appetite} onChange={(e) => onChange('appetite', e.target.value)} />

            <input placeholder="Pain score (0-10)*" className="border rounded-lg px-2 py-2 text-sm" value={form.painScore} onChange={(e) => onChange('painScore', e.target.value)} />
            <input placeholder="CRT (sec)" className="border rounded-lg px-2 py-2 text-sm" value={form.capillaryRefillTime} onChange={(e) => onChange('capillaryRefillTime', e.target.value)} />
            <input placeholder="SpO2 (%)" className="border rounded-lg px-2 py-2 text-sm" value={form.spo2} onChange={(e) => onChange('spo2', e.target.value)} />

            <input placeholder="Blood glucose (mg/dL)" className="border rounded-lg px-2 py-2 text-sm" value={form.bloodGlucose} onChange={(e) => onChange('bloodGlucose', e.target.value)} />
            <input placeholder="BP Systolic (mmHg)" className="border rounded-lg px-2 py-2 text-sm" value={form.bloodPressureSystolic} onChange={(e) => onChange('bloodPressureSystolic', e.target.value)} />
            <input placeholder="BP Diastolic (mmHg)" className="border rounded-lg px-2 py-2 text-sm" value={form.bloodPressureDiastolic} onChange={(e) => onChange('bloodPressureDiastolic', e.target.value)} />

            <select className="border rounded-lg px-2 py-2 text-sm" value={form.followUpAction} onChange={(e) => onChange('followUpAction', e.target.value as FollowUpAction)}>
              <option value="watch">Watch</option>
              <option value="recheck">Recheck</option>
              <option value="escalate">Escalate</option>
              <option value="medication_adjustment">Medication Adjustment</option>
              <option value="diagnostics">Diagnostics</option>
            </select>
            <input placeholder="Follow-up in hours" className="border rounded-lg px-2 py-2 text-sm" value={form.followUpInHours} onChange={(e) => onChange('followUpInHours', e.target.value)} />
            <input placeholder="Override reason (required if out of range)" className="border rounded-lg px-2 py-2 text-sm" value={form.editReason} onChange={(e) => onChange('editReason', e.target.value)} />
          </div>

          <textarea
            placeholder="Clinical notes*"
            className="mt-2 border rounded-lg px-2 py-2 text-sm w-full min-h-20"
            value={form.clinicalNotes}
            onChange={(e) => onChange('clinicalNotes', e.target.value)}
          />

          <label className="mt-2 inline-flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.requiresImmediateReview}
              onChange={(e) => onChange('requiresImmediateReview', e.target.checked)}
            />
            Requires immediate review
          </label>

          <div className="mt-3 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-3 py-2 rounded-lg bg-[#476B6B] text-white text-sm hover:bg-[#3c5b5b] disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Monitoring Entry'}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {entries.length === 0 && !loading && (
            <p className="text-sm text-gray-500">No confinement monitoring entries yet.</p>
          )}
          {entries.map((entry) => {
            const recorder = typeof entry.recorderId === 'string'
              ? entry.recorderId
              : `${entry.recorderId?.firstName || ''} ${entry.recorderId?.lastName || ''}`.trim() || 'Unknown'
            const isCritical = entry.clinicalFlag === 'critical' || entry.requiresImmediateReview

            return (
              <div
                key={entry._id}
                className={`border rounded-lg p-3 ${isCritical ? 'border-red-200 bg-red-50/40' : 'border-gray-200 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#4F4F4F]">
                      {entry.entryType === 'daily' ? 'Daily Vitals' : 'Spot Monitoring'} · {new Date(entry.recordedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Recorded by {recorder} ({entry.recorderRole})</p>
                  </div>
                  {isCritical && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-red-100 text-red-700">
                      <AlertTriangle className="w-3.5 h-3.5" /> Critical
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                  <p className="inline-flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> {entry.temperature.value} °C</p>
                  <p className="inline-flex items-center gap-1"><HeartPulse className="w-3.5 h-3.5" /> {entry.heartRate.value} bpm</p>
                  <p className="inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {entry.respiratoryRate.value} /min</p>
                  <p className="inline-flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> {entry.weight.value} kg</p>
                </div>

                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{entry.clinicalNotes}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Hydration: {entry.hydrationStatus}</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Appetite: {entry.appetite}</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Pain: {entry.painScore}/10</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Follow-up: {entry.followUpAction}</span>
                  {entry.followUpInHours != null && (
                    <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Recheck in {entry.followUpInHours}h</span>
                  )}
                </div>

                {isCritical && !entry.alertResolved && (
                  <div className="mt-3 flex justify-end">
                    <button
                      onClick={() => handleResolve(entry._id)}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Mark Alert Resolved
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
