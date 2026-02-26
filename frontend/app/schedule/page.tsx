'use client'

import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import { Calendar, ChevronLeft, ChevronRight, Clock, Building2, MapPin, Save, CheckCircle } from 'lucide-react'
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
  Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday'
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

// ==================== BRANCH SCHEDULE CARD ====================

function BranchCard({ entry, onSaved }: { entry: BranchSchedule; onSaved: () => void }) {
  const { token } = useAuthStore()

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

  const handleSave = async () => {
    if (workingDays.length === 0) { toast.error('Select at least one working day'); return }
    if (startTime >= endTime) { toast.error('Start time must be before end time'); return }
    setSaving(true)
    try {
      const res = await authenticatedFetch(
        `/vet-schedule/${entry.branchId}`,
        { method: 'PUT', body: JSON.stringify({ workingDays, startTime, endTime }) },
        token || undefined
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

  const availableDays = entry.branchOperatingDays.length > 0
    ? ALL_DAYS.filter((d) => entry.branchOperatingDays.includes(d))
    : ALL_DAYS

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

// ==================== MAIN PAGE ====================

export default function MySchedulePage() {
  const { token } = useAuthStore()
  const [schedules, setSchedules] = useState<BranchSchedule[]>([])
  const [loadingSchedules, setLoadingSchedules] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  const loadSchedules = useCallback(async () => {
    if (!token) return
    setLoadingSchedules(true)
    try {
      const res = await authenticatedFetch('/vet-schedule/mine', { method: 'GET' }, token)
      if (res.status === 'SUCCESS' && res.data?.schedules) {
        setSchedules(res.data.schedules)
      }
    } catch {
      /* silent */
    } finally {
      setLoadingSchedules(false)
    }
  }, [token])

  useEffect(() => {
    loadSchedules()
  }, [loadSchedules])

  // Calendar helpers
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  const previousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))

  const today = new Date()
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const days: (number | null)[] = []
  const firstDay = firstDayOfMonth(currentDate)
  const daysCount = daysInMonth(currentDate)

  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysCount; i++) days.push(i)

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentDate.getMonth() === today.getMonth() &&
    currentDate.getFullYear() === today.getFullYear()

  return (
    <DashboardLayout userType="veterinarian">
      <div className="p-8">
        <h1 className="text-3xl font-bold text-[#4F4F4F] mb-8">My Schedule</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#4F4F4F]">{monthName}</h2>
              <div className="flex gap-1">
                <button onClick={previousMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-center text-[10px] font-semibold text-gray-600 py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => (
                <div
                  key={index}
                  className={`aspect-square rounded-lg flex items-center justify-center text-sm font-medium ${
                    day === null
                      ? 'bg-gray-50'
                      : isToday(day)
                        ? 'bg-[#7FA5A3] text-white'
                        : 'bg-gray-50 text-[#4F4F4F] hover:bg-gray-100 cursor-pointer transition-colors'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            {/* Upcoming */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-[#4F4F4F] mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Upcoming
              </h2>
              <div className="space-y-3">
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-lg">
                  <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">No scheduled appointments</p>
                </div>
              </div>
            </div>

            {/* Working hours / schedule setter */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-semibold text-[#4F4F4F] mb-3">Working Hours</h3>

              {loadingSchedules ? (
                <div className="flex justify-center py-6">
                  <div className="w-6 h-6 border-2 border-[#7FA5A3] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : schedules.length === 0 ? (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
                  <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm font-medium">No approved clinic assignments yet</p>
                  <p className="text-gray-400 text-xs mt-1">Your branch will appear here once a clinic approves your application.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((entry) => (
                    <BranchCard key={entry.branchId} entry={entry} onSaved={loadSchedules} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Daily Schedule */}
        <div className="mt-4 bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[#4F4F4F] mb-4">Today&apos;s Schedule</h2>
          <div className="space-y-2">
            {Array.from({ length: 8 }, (_, i) => {
              const hour = 9 + i
              const period = hour >= 12 ? 'PM' : 'AM'
              const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
              return (
                <div key={i} className="flex items-start gap-3 pb-2 border-b border-gray-100 last:border-b-0">
                  <div className="text-xs font-semibold text-gray-600 w-16">
                    {displayHour}:00 {period}
                  </div>
                  <div className="flex-1 py-1.5 px-3 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">
                    Available
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
