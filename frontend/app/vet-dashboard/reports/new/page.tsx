'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import PageHeader from '@/components/PageHeader'
import { useAuthStore } from '@/store/authStore'
import { getVetMedicalRecords, type MedicalRecord } from '@/lib/medicalRecords'
import { createVetReport } from '@/lib/vetReports'
import { ArrowLeft, Search, PawPrint, CalendarDays, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function NewReportPage() {
  const router = useRouter()
  const { token, user } = useAuthStore()
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<MedicalRecord | null>(null)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await getVetMedicalRecords({ limit: 100 }, token || undefined)
        setRecords(res.data?.records ?? [])
      } catch {
        toast.error('Failed to load records')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const filtered = records.filter((r) => {
    const q = search.toLowerCase()
    if (!q) return true
    const petName = typeof r.petId === 'object' ? r.petId?.name : ''
    return petName?.toLowerCase().includes(q)
  })

  const handleCreate = async () => {
    if (!selected) {
      toast.error('Please select a medical record')
      return
    }
    setCreating(true)
    try {
      const petId = typeof selected.petId === 'object' ? selected.petId._id : selected.petId
      const defaultTitle = title.trim() || `Diagnostic Report — ${typeof selected.petId === 'object' ? selected.petId.name : 'Patient'} — ${fmtDate(selected.createdAt)}`
      const report = await createVetReport(
        { petId, medicalRecordId: selected._id, title: defaultTitle },
        token || undefined
      )
      router.push(`/vet-dashboard/reports/${report._id}`)
    } catch (e: any) {
      toast.error(e.message || 'Failed to create report')
      setCreating(false)
    }
  }

  return (
    <DashboardLayout userType={user?.userType as any}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <PageHeader
          title="New Report"
          subtitle="Select a medical record to generate or write a diagnostic report"
          className="mb-6"
        />

        {/* Title (optional) */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Title (optional)</label>
          <input
            type="text"
            placeholder="e.g. Diagnostic Report — Chewie — Nov 2025"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>

        {/* Record selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Link to Medical Record <span className="text-gray-400 font-normal">(required)</span>
          </label>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 rounded-lg border border-gray-100 p-2 bg-gray-50">
              {filtered.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No records found</p>
              ) : (
                filtered.map((r) => {
                  const pet = typeof r.petId === 'object' ? r.petId : null
                  const isSelected = selected?._id === r._id
                  return (
                    <button
                      key={r._id}
                      onClick={() => setSelected(r)}
                      className={`w-full text-left rounded-lg px-4 py-3 border transition-all ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-300'
                          : 'border-gray-200 bg-white hover:border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <PawPrint className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-gray-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900 truncate">
                            {pet?.name ?? 'Unknown pet'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500">
                              {pet?.species === 'canine' ? 'Canine' : 'Feline'} / {pet?.breed}
                            </span>
                            {r.chiefComplaint && (
                              <span className="text-xs text-gray-400 truncate max-w-[180px]">
                                · {r.chiefComplaint}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                          <CalendarDays className="w-3 h-3" />
                          {fmtDate(r.createdAt)}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        {selected && (
          <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
            Selected: <strong>{typeof selected.petId === 'object' ? selected.petId.name : 'Unknown'}</strong> — {fmtDate(selected.createdAt)}
            {selected.chiefComplaint && ` — "${selected.chiefComplaint}"`}
          </div>
        )}

        <button
          onClick={handleCreate}
          disabled={!selected || creating}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Creating…
            </>
          ) : (
            'Create Report & Open Editor'
          )}
        </button>
      </div>
    </DashboardLayout>
  )
}
