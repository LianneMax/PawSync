'use client'

import { useState } from 'react'
import { Printer, Download } from 'lucide-react'

export function ReportActions({ targetId, filename }: { targetId: string; filename: string }) {
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    const element = document.getElementById(targetId)
    if (!element) return
    setDownloading(true)
    // Hide on-screen-only chrome (buttons, page hints) so it doesn't end up in the PDF
    const hidden = Array.from(document.querySelectorAll<HTMLElement>('.report-no-print'))
    const prevDisplay = hidden.map((el) => el.style.display)
    hidden.forEach((el) => { el.style.display = 'none' })
    // html2canvas snapshots the on-screen DOM, not print media — force any collapsed
    // addenda open so corrections aren't silently dropped from the exported PDF.
    const collapsedAddenda = Array.from(document.querySelectorAll<HTMLDetailsElement>('.report-addenda-details:not([open])'))
    collapsedAddenda.forEach((el) => { el.open = true })
    try {
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf()
        .set({
          margin: 0,
          filename,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'], after: '.report-print-page' },
        })
        .from(element)
        .save()
    } catch {
      window.alert('Unable to download the report PDF right now. Use Print instead.')
    } finally {
      hidden.forEach((el, i) => { el.style.display = prevDisplay[i] })
      collapsedAddenda.forEach((el) => { el.open = false })
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:bg-gray-50 shadow-sm"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
      <button
        onClick={handleDownload}
        disabled={downloading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#476B6B] text-white text-sm hover:bg-[#3a5858] shadow-sm disabled:opacity-60"
      >
        <Download className="w-4 h-4" /> {downloading ? 'Downloading…' : 'Download'}
      </button>
    </div>
  )
}
