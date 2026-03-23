'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { HeartPulse, Activity, Thermometer, Weight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import {
  createConfinementMonitoringEntry,
  listConfinementMonitoringEntries,
  type MonitoringEntry,
} from '@/lib/confinementMonitoring'

type MonitoringForm = {
  recordedAt: string
  temperature: string
  pulseRate: string
  spo2: string
  weight: string
  bodyConditionScore: string
  dentalScore: string
  capillaryRefillTime: string
  clinicalNotes: string
}

const emptyForm = (): MonitoringForm => ({
  recordedAt: '',
  temperature: '',
  pulseRate: '',
  spo2: '',
  weight: '',
  bodyConditionScore: '',
  dentalScore: '',
  capillaryRefillTime: '',
  clinicalNotes: '',
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
      pulseDelta: delta(latest?.heartRate?.value, prev?.heartRate?.value),
      spo2Delta: delta(latest?.spo2?.value, prev?.spo2?.value),
      weightDelta: delta(latest?.weight?.value, prev?.weight?.value),
    }
  }, [entries])

  const onChange = <K extends keyof MonitoringForm>(key: K, value: MonitoringForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    const required = ['recordedAt', 'temperature', 'pulseRate', 'spo2', 'weight', 'bodyConditionScore', 'dentalScore', 'capillaryRefillTime', 'clinicalNotes'] as const
    for (const key of required) {
      if (!String(form[key]).trim()) {
        toast.error('Please complete all required vitals and notes fields')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        entryType: 'spot',
        recordedAt: new Date(form.recordedAt).toISOString(),
        temperature: Number(form.temperature),
        heartRate: Number(form.pulseRate),
        weight: Number(form.weight),
        spo2: Number(form.spo2),
        bodyConditionScore: Number(form.bodyConditionScore),
        dentalScore: Number(form.dentalScore),
        capillaryRefillTime: Number(form.capillaryRefillTime),
        clinicalNotes: form.clinicalNotes,
        clinicalFlag: 'normal',
        followUpAction: 'watch',
        requiresImmediateReview: false,
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
            <p className="text-[10px] uppercase text-gray-400">Pulse Rate</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.heartRate?.value ?? '—'} bpm</p>
            <p className="text-[10px] text-gray-500">Δ {trend.pulseDelta ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">SpO₂</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.spo2?.value ?? '—'} %</p>
            <p className="text-[10px] text-gray-500">Δ {trend.spo2Delta ?? '—'}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="text-[10px] uppercase text-gray-400">Weight</p>
            <p className="text-sm font-semibold text-[#4F4F4F]">{trend.latest?.weight?.value ?? '—'} kg</p>
            <p className="text-[10px] text-gray-500">Δ {trend.weightDelta ?? '—'}</p>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-3 bg-white">
          <p className="text-xs font-semibold text-[#476B6B] uppercase tracking-wider mb-2">Log Vitals (Date/Time Taken)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input type="datetime-local" className="border rounded-lg px-2 py-2 text-sm md:col-span-3" value={form.recordedAt} onChange={(e) => onChange('recordedAt', e.target.value)} />
            <input placeholder="Temperature (°C)*" className="border rounded-lg px-2 py-2 text-sm" value={form.temperature} onChange={(e) => onChange('temperature', e.target.value)} />
            <input placeholder="Pulse Rate (bpm)*" className="border rounded-lg px-2 py-2 text-sm" value={form.pulseRate} onChange={(e) => onChange('pulseRate', e.target.value)} />
            <input placeholder="SpO₂ (%)*" className="border rounded-lg px-2 py-2 text-sm" value={form.spo2} onChange={(e) => onChange('spo2', e.target.value)} />
            <input placeholder="Weight (kg)*" className="border rounded-lg px-2 py-2 text-sm" value={form.weight} onChange={(e) => onChange('weight', e.target.value)} />
            <input placeholder="Body Condition Score (1-5)*" className="border rounded-lg px-2 py-2 text-sm" value={form.bodyConditionScore} onChange={(e) => onChange('bodyConditionScore', e.target.value)} />
            <input placeholder="Dental Score (1-3)*" className="border rounded-lg px-2 py-2 text-sm" value={form.dentalScore} onChange={(e) => onChange('dentalScore', e.target.value)} />
            <input placeholder="CRT (sec)*" className="border rounded-lg px-2 py-2 text-sm" value={form.capillaryRefillTime} onChange={(e) => onChange('capillaryRefillTime', e.target.value)} />
          </div>

          <textarea
            placeholder="Notes on how the pet is doing*"
            className="mt-2 border rounded-lg px-2 py-2 text-sm w-full min-h-20"
            value={form.clinicalNotes}
            onChange={(e) => onChange('clinicalNotes', e.target.value)}
          />

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

            return (
              <div
                key={entry._id}
                className="border rounded-lg p-3 border-gray-200 bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#4F4F4F]">
                      Vitals Log · {new Date(entry.recordedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">Recorded by {recorder} ({entry.recorderRole})</p>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                  <p className="inline-flex items-center gap-1"><Thermometer className="w-3.5 h-3.5" /> {entry.temperature.value} °C</p>
                  <p className="inline-flex items-center gap-1"><HeartPulse className="w-3.5 h-3.5" /> {entry.heartRate.value} bpm</p>
                  <p className="inline-flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {entry.spo2?.value ?? '—'} %</p>
                  <p className="inline-flex items-center gap-1"><Weight className="w-3.5 h-3.5" /> {entry.weight.value} kg</p>
                </div>

                <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{entry.clinicalNotes}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">BCS: {entry.bodyConditionScore?.value ?? '—'}/5</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">Dental: {entry.dentalScore?.value ?? '—'}/3</span>
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">CRT: {entry.capillaryRefillTime?.value ?? '—'} sec</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
