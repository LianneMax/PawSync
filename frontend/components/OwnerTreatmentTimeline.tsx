'use client'

import { Pill } from 'lucide-react'
import type { TreatmentItem } from '@/lib/vetReports'

// Owner-facing treatment plan: a table whose rows carry a dated timeline rail down the
// left edge (chronological by start/visit date). Clinical columns are read-only facts from
// the record; only the "What it does" explanation is editable (vet editor only).

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 border-green-200',
  completed: 'bg-gray-100 text-gray-600 border-gray-200',
  discontinued: 'bg-amber-100 text-amber-700 border-amber-200',
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : null

function dateRange(item: TreatmentItem): string {
  const start = fmtDate(item.startDate) ?? fmtDate(item.visitDate)
  const end = fmtDate(item.endDate)
  if (start && end) return `${start} – ${end}`
  if (start) return start
  return 'Not specified'
}

// The dot label: the earliest known date for this row, driving the timeline feel.
function railDate(item: TreatmentItem): string {
  return fmtDate(item.startDate) ?? fmtDate(item.visitDate) ?? '—'
}

export default function OwnerTreatmentTimeline({
  items,
  editable = false,
  onChange,
}: {
  items: TreatmentItem[]
  editable?: boolean
  onChange?: (index: number, whatItDoes: string) => void
}) {
  if (!items?.length) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
        <thead className="bg-[#f0f7f7]">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-[#476B6B] w-28">When</th>
            <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Treatment</th>
            <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">What it does</th>
            <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Schedule</th>
            <th className="px-3 py-2 text-left font-semibold text-[#476B6B]">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const isLast = i === items.length - 1
            const statusKey = (item.status || '').toLowerCase()
            const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.completed
            return (
              <tr key={i} className="border-t border-gray-100 align-top">
                {/* Timeline rail: dot + connecting line + the row's date */}
                <td className="px-3 py-3 relative">
                  <div className="flex gap-2">
                    <div className="relative flex flex-col items-center pt-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#476B6B] ring-2 ring-[#f0f7f7] z-10" />
                      {!isLast && (
                        <span className="absolute top-1 w-px bg-[#cfe0de] h-[calc(100%+1.5rem)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-gray-500 leading-snug">{railDate(item)}</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-[#4F4F4F]">{item.name || 'Treatment'}</p>
                  {(item.dosage || item.route) && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {[item.dosage, item.route].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">{dateRange(item)}</p>
                </td>
                <td className="px-3 py-3 min-w-[200px]">
                  {editable ? (
                    <textarea
                      value={item.whatItDoes}
                      onChange={(e) => onChange?.(i, e.target.value)}
                      rows={3}
                      placeholder="Plain-language explanation for the owner…"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-700 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    />
                  ) : (
                    <p className="text-gray-700 leading-relaxed">{item.whatItDoes || '—'}</p>
                  )}
                </td>
                <td className="px-3 py-3 text-gray-600">
                  <p>{item.frequency || '—'}</p>
                  {item.duration && <p className="text-[11px] text-gray-400 mt-0.5">for {item.duration}</p>}
                </td>
                <td className="px-3 py-3">
                  {item.status ? (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium capitalize ${statusStyle}`}>
                      <Pill className="w-2.5 h-2.5" />
                      {item.status}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
