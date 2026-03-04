'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { authenticatedFetch } from '@/lib/auth'
import { Building2, Clock, MapPin, Save, CheckCircle, X } from 'lucide-react'
import { toast } from 'sonner'

// ==================== TYPES ====================

interface BranchSchedule {
  branchId: string
  branchName: string
  branchAddress: string
  branchOpeningTime: string | null
  branchClosingTime: string | null
  branchOperatingDays: string[]
  schedule: {
    _id: string
    workingDays: string[]
    startTime: string
    endTime: string
  } | null
}

// ==================== HELPERS ====================

const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_LABELS: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday',
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

function formatTime(time: string | null) {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${display}:${m.toString().padStart(2, '0')} ${ampm}`
}

function generateTimeOptions(openingTime: string | null, closingTime: string | null) {
  const start = openingTime || '07:00'
  const end = closingTime || '17:00'
  const options: { value: string; label: string }[] = []
  let [h, m] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)

  while (h < endH || (h === endH && m <= endM)) {
    const hStr = h.toString().padStart(2, '0')
    const mStr = m.toString().padStart(2, '0')
    const value = `${hStr}:${mStr}`
    options.push({ value, label: formatTime(value) })
    m += 30
    if (m >= 60) { h++; m -= 60 }
  }
  return options
}

// ==================== BRANCH EDITOR ====================

function BranchEditor({ entry, token, onSaved }: { entry: BranchSchedule; token: string; onSaved: () => void }) {
  const defaultStart = entry.schedule?.startTime || entry.branchOpeningTime || '09:00'
  const defaultEnd = entry.schedule?.endTime || entry.branchClosingTime || '17:00'
  const defaultDays = entry.schedule?.workingDays || entry.branchOperatingDays || []

  const [workingDays, setWorkingDays] = useState<string[]>(defaultDays)
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWorkingDays(entry.schedule?.workingDays || entry.branchOperatingDays || [])
    setStartTime(entry.schedule?.startTime || entry.branchOpeningTime || '09:00')
    setEndTime(entry.schedule?.endTime || entry.branchClosingTime || '17:00')
  }, [entry])

  const toggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const timeOptions = generateTimeOptions(entry.branchOpeningTime, entry.branchClosingTime)

  const availableDays = entry.branchOperatingDays.length > 0
    ? ALL_DAYS.filter((d) => entry.branchOperatingDays.includes(d))
    : ALL_DAYS

  const handleSave = async () => {
    if (workingDays.length === 0) { toast.error('Select at least one working day'); return }
    if (startTime >= endTime) { toast.error('Start time must be before end time'); return }
    setSaving(true)
    try {
      const res = await authenticatedFetch(
        `/vet-schedule/${entry.branchId}`,
        { method: 'PUT', body: JSON.stringify({ workingDays, startTime, endTime }) },
        token
      )
      if (res.status === 'SUCCESS') {
        toast.success('Schedule saved!')
        onSaved()
      } else {
        toast.error(res.message || 'Failed to save schedule')
      }
    } catch {
      toast.error('An error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Branch header */}
      <div className="px-4 py-3 bg-[#F8F6F2] border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Building2 className="w-3.5 h-3.5 text-[#5A7C7A] shrink-0" />
              <p className="font-semibold text-[#2C3E2D] text-sm truncate">{entry.branchName}</p>
            </div>
            {entry.branchAddress && (
              <p className="text-xs text-gray-500 flex items-center gap-1 ml-5 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {entry.branchAddress}
              </p>
            )}
          </div>
          {entry.schedule && (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium shrink-0">
              <CheckCircle className="w-3 h-3" /> Set
            </span>
          )}
        </div>
        {(entry.branchOpeningTime || entry.branchClosingTime) && (
          <p className="text-xs text-gray-400 mt-1.5 ml-5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTime(entry.branchOpeningTime)} – {formatTime(entry.branchClosingTime)}
            {entry.branchOperatingDays.length > 0 && (
              <span className="ml-1">· {entry.branchOperatingDays.join(', ')}</span>
            )}
          </p>
        )}
      </div>

      {/* Editor */}
      <div className="px-4 py-4 space-y-4">
        {/* Working days */}
        <div>
          <p className="text-xs font-semibold text-[#2C3E2D] mb-2">My working days</p>
          <div className="flex flex-wrap gap-1.5">
            {availableDays.map((day) => {
              const selected = workingDays.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                    selected
                      ? 'bg-[#7FA5A3] text-white border-[#7FA5A3]'
                      : 'bg-white text-[#4F4F4F] border-gray-300 hover:border-[#7FA5A3]/60'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-[#2C3E2D] mb-1.5">Start</p>
            <select
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] bg-white"
            >
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value >= endTime}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#2C3E2D] mb-1.5">End</p>
            <select
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] bg-white"
            >
              {timeOptions.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value <= startTime}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview */}
        {workingDays.length > 0 && startTime < endTime && (
          <div className="bg-[#7FA5A3]/10 rounded-lg px-3 py-2 text-xs text-[#4F4F4F]">
            <span className="font-medium text-[#2C3E2D]">Schedule: </span>
            {workingDays.map((d) => DAY_LABELS[d] || d).join(', ')}
            {' · '}{formatTime(startTime)} – {formatTime(endTime)}
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-[#7FA5A3] text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-[#6b9391] transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ==================== MODAL ====================

interface WorkingHoursModalProps {
  open: boolean
  onClose: () => void
  token: string
}

export default function WorkingHoursModal({ open, onClose, token }: WorkingHoursModalProps) {
  const [schedules, setSchedules] = useState<BranchSchedule[]>([])
  const [loading, setLoading] = useState(false)

  const loadSchedules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authenticatedFetch('/vet-schedule/mine', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.schedules) {
        setSchedules(res.data.schedules)
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (open) loadSchedules()
  }, [open, loadSchedules])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-lg p-0 gap-0 rounded-2xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-[#2C3E2D]">Working Hours</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm font-medium">No approved clinic assignments yet</p>
              <p className="text-gray-400 text-xs mt-1">
                Your branch will appear here once a clinic approves your application.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {schedules.map((entry) => (
                <BranchEditor
                  key={entry.branchId}
                  entry={entry}
                  token={token}
                  onSaved={loadSchedules}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
