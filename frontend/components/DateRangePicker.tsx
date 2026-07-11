'use client'

import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X } from 'lucide-react'
import {
  endOfMonth,
  endOfYear,
  format,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const toLocalYmd = (d: Date) => d.toLocaleDateString('en-CA')
const parseLocalYmd = (s: string) => new Date(s + 'T00:00:00')

interface DateRangePickerProps {
  from: string
  to: string
  /** Called with local yyyy-MM-dd strings ('' when cleared) */
  onApply: (from: string, to: string) => void
  /** Latest selectable day; defaults to today (no future dates) */
  maxDate?: Date
  placeholder?: string
}

export function DateRangePicker({
  from,
  to,
  onApply,
  maxDate = new Date(),
  placeholder = 'Pick a date range',
}: DateRangePickerProps) {
  const today = maxDate
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(today)

  const selected: DateRange | undefined = from
    ? { from: parseLocalYmd(from), to: to ? parseLocalYmd(to) : undefined }
    : undefined

  const presets: { label: string; range: DateRange }[] = [
    { label: 'Today', range: { from: today, to: today } },
    { label: 'Yesterday', range: { from: subDays(today, 1), to: subDays(today, 1) } },
    { label: 'Last 7 days', range: { from: subDays(today, 6), to: today } },
    { label: 'Last 30 days', range: { from: subDays(today, 29), to: today } },
    { label: 'Month to date', range: { from: startOfMonth(today), to: today } },
    { label: 'Last month', range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) } },
    { label: 'Year to date', range: { from: startOfYear(today), to: today } },
    { label: 'Last year', range: { from: startOfYear(subYears(today, 1)), to: endOfYear(subYears(today, 1)) } },
  ]

  const applyRange = (range: DateRange | undefined) => {
    if (!range?.from) {
      onApply('', '')
      return
    }
    onApply(toLocalYmd(range.from), range.to ? toLocalYmd(range.to) : '')
  }

  const displayText = selected?.from
    ? selected.to
      ? `${format(selected.from, 'LLL dd, y')} - ${format(selected.to, 'LLL dd, y')}`
      : format(selected.from, 'LLL dd, y')
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-left hover:border-[#7FA5A3] focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-colors ${
            from ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          <span className="truncate">{displayText}</span>
          <span className="flex items-center gap-1.5 shrink-0">
            {from && (
              <span
                role="button"
                tabIndex={0}
                title="Clear date range"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); onApply('', '') }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onApply('', '') } }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <CalendarDays className="w-4 h-4 text-gray-400" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0 overflow-hidden">
        <div className="flex max-sm:flex-col">
          {/* Presets sidebar */}
          <div className="relative py-3 max-sm:order-1 max-sm:border-t sm:w-36 border-gray-100">
            <div className="h-full sm:border-e sm:border-gray-100">
              <div className="flex flex-col px-2 gap-0.5">
                {presets.map(({ label, range }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      applyRange(range)
                      setMonth(range.to ?? range.from ?? today)
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-lg hover:bg-[#f0f7f7] hover:text-[#476B6B] transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Range calendar */}
          <Calendar
            mode="range"
            captionLayout="label"
            hideNavigation={false}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(newDate) => { if (newDate) applyRange(newDate) }}
            disabled={[{ after: today }]}
            endMonth={today}
            classNames={{
              caption_label: 'text-sm font-semibold text-[#4F4F4F]',
              nav: 'absolute top-3 inset-x-3 z-20 flex items-center justify-between',
              button_previous:
                'size-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#4F4F4F] transition-colors disabled:opacity-30 disabled:pointer-events-none',
              button_next:
                'size-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#4F4F4F] transition-colors disabled:opacity-30 disabled:pointer-events-none',
            }}
            components={{
              Chevron: ({ orientation }) => {
                if (orientation === 'left') return <ChevronLeft className="h-4 w-4" />
                if (orientation === 'right') return <ChevronRight className="h-4 w-4" />
                if (orientation === 'up') return <ChevronUp className="h-4 w-4" />
                return <ChevronDown className="h-4 w-4" />
              },
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
