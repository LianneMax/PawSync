'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { authenticatedFetch } from '@/lib/auth'
import { Building2, Clock, MapPin, Save, CheckCircle, X, Coffee } from 'lucide-react'
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
    breakStart: string | null
    breakEnd: string | null
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
  const [breakEnabled, setBreakEnabled] = useState(
    !!(entry.schedule?.breakStart && entry.schedule?.breakEnd)
  )
  const [breakStart, setBreakStart] = useState(entry.schedule?.breakStart || '12:00')
  const [breakEnd, setBreakEnd] = useState(entry.schedule?.breakEnd || '13:00')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setWorkingDays(entry.schedule?.workingDays || entry.branchOperatingDays || [])
    setStartTime(entry.schedule?.startTime || entry.branchOpeningTime || '09:00')
    setEndTime(entry.schedule?.endTime || entry.branchClosingTime || '17:00')
    const hasBreak = !!(entry.schedule?.breakStart && entry.schedule?.breakEnd)
    setBreakEnabled(hasBreak)
    setBreakStart(entry.schedule?.breakStart || '12:00')
    setBreakEnd(entry.schedule?.breakEnd || '13:00')
  }, [entry])

  const toggleDay = (day: string) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const timeOptions = generateTimeOptions(entry.branchOpeningTime, entry.branchClosingTime)

  // Break start: must be strictly inside working hours
  const breakStartOptions = timeOptions.filter(
    (opt) => opt.value > startTime && opt.value < endTime
  )
  // Break end: must be after break start and still inside working hours
  const breakEndOptions = timeOptions.filter(
    (opt) => opt.value > breakStart && opt.value < endTime
  )

  const availableDays = entry.branchOperatingDays.length > 0
    ? ALL_DAYS.filter((d) => entry.branchOperatingDays.includes(d))
    : ALL_DAYS

  const handleSave = async () => {
    if (workingDays.length === 0) { toast.error('Select at least one working day'); return }
    if (startTime >= endTime) { toast.error('Start time must be before end time'); return }
    if (breakEnabled) {
      if (breakStart >= breakEnd) { toast.error('Break start must be before break end'); return }
      if (breakStart <= startTime || breakEnd >= endTime) {
        toast.error('Break must fall within working hours'); return
      }
    }
    setSaving(true)
    try {
      const res = await authenticatedFetch(
        `/vet-schedule/${entry.branchId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            workingDays,
            startTime,
            endTime,
            breakStart: breakEnabled ? breakStart : null,
            breakEnd: breakEnabled ? breakEnd : null,
          }),
        },
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

        {/* Working hours */}
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

        {/* Break toggle */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setBreakEnabled((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-[#2C3E2D]">
              <Coffee className="w-3.5 h-3.5 text-[#7FA5A3]" />
              Break / Gap Time
            </span>
            <span className={`w-8 h-4.5 flex items-center rounded-full px-0.5 transition-colors ${breakEnabled ? 'bg-[#7FA5A3]' : 'bg-gray-200'}`}>
              <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${breakEnabled ? 'translate-x-3.5' : 'translate-x-0'}`} />
            </span>
          </button>

          {breakEnabled && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-[#2C3E2D] mb-1.5">Break start</p>
                {breakStartOptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No valid times</p>
                ) : (
                  <select
                    value={breakStart}
                    onChange={(e) => setBreakStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] bg-white"
                  >
                    {breakStartOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} disabled={opt.value >= breakEnd}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[#2C3E2D] mb-1.5">Break end</p>
                {breakEndOptions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No valid times</p>
                ) : (
                  <select
                    value={breakEnd}
                    onChange={(e) => setBreakEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-[#4F4F4F] focus:outline-none focus:border-[#7FA5A3] bg-white"
                  >
                    {breakEndOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        {workingDays.length > 0 && startTime < endTime && (
          <div className="bg-[#7FA5A3]/10 rounded-lg px-3 py-2 text-xs text-[#4F4F4F] space-y-0.5">
            <div>
              <span className="font-medium text-[#2C3E2D]">Schedule: </span>
              {workingDays.map((d) => DAY_LABELS[d] || d).join(', ')}
              {' · '}{formatTime(startTime)} – {formatTime(endTime)}
            </div>
            {breakEnabled && breakStart < breakEnd && (
              <div className="flex items-center gap-1 text-gray-500">
                <Coffee className="w-3 h-3" />
                Break: {formatTime(breakStart)} – {formatTime(breakEnd)}
              </div>
            )}
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
