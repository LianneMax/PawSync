'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, PawPrint, Stethoscope, Hash, Plus, Search, Loader2, CheckCircle } from 'lucide-react'
import { type MedicalRecord } from '@/lib/medicalRecords'
import { authenticatedFetch } from '@/lib/auth'
import { toast } from 'sonner'

// ---- Types ----

interface CatalogEntry {
  id: string
  name: string
  type: 'Service' | 'Product' | 'Vaccine'
  category: string
  price: number
  administrationRoute?: string
}

interface BillingLineItem {
  tempId: string
  name: string
  price: number
  type: 'Service' | 'Product' | 'Vaccine'
  category: string
  catalogId: string | null
  catalogKind: 'product-service' | 'vaccine' | 'unmatched'
}

export interface BillingFromRecordModalProps {
  open: boolean
  mode: 'create' | 'view' | 'update'
  onClose: () => void
  patientName: string
  appointmentId: string | null
  vetName: string
  record?: MedicalRecord
  token?: string
  onBillingCreated?: (billingId: string) => void
}

// ---- Helpers ----

function formatCurrency(amount: number) {
  return `₱ ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

function matchByName(name: string, catalog: CatalogEntry[]): CatalogEntry | undefined {
  const n = normalizeName(name)
  return (
    catalog.find((c) => normalizeName(c.name) === n) ||
    catalog.find((c) => normalizeName(c.name).includes(n) || n.includes(normalizeName(c.name)))
  )
}

let tempIdCounter = 0
function nextTempId() {
  return `tmp-${++tempIdCounter}`
}

const MODAL_TITLES: Record<BillingFromRecordModalProps['mode'], string> = {
  create: 'Create Billing',
  view: 'View Billing',
  update: 'Update Billing',
}

const CATEGORY_ORDER = ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Vaccines', 'Others']

function groupByCategoryOrdered(entries: CatalogEntry[]) {
  const map = new Map<string, CatalogEntry[]>()
  for (const e of entries) {
    if (!map.has(e.category)) map.set(e.category, [])
    map.get(e.category)!.push(e)
  }
  const result: { category: string; items: CatalogEntry[] }[] = []
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) result.push({ category: cat, items: map.get(cat)! })
  }
  for (const [cat, items] of map) {
    if (!CATEGORY_ORDER.includes(cat)) result.push({ category: cat, items })
  }
  return result
}

export default function BillingFromRecordModal({
  open,
  mode,
  onClose,
  patientName,
  appointmentId,
  vetName,
  record,
  token,
  onBillingCreated,
}: BillingFromRecordModalProps) {
  const [items, setItems] = useState<BillingLineItem[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [addSearch, setAddSearch] = useState('')

  const isReadOnly = mode === 'view'
  const total = items.reduce((sum, item) => sum + item.price, 0)

  // ---- Fetch catalog & auto-populate when modal opens in create/update mode ----
  useEffect(() => {
    if (!open || isReadOnly) return
    if (!record) return

    const run = async () => {
      setLoading(true)
      setItems([])
      setSaved(false)
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

        // 1. Fetch product-services and vaccine-types in parallel
        const [psRes, vtRes] = await Promise.all([
          authenticatedFetch('/product-services', { method: 'GET' }, token),
          fetch(`${apiBase}/vaccine-types`).then((r) => r.json()),
        ])

        const productServices: CatalogEntry[] = (psRes?.data?.items ?? [])
          .filter((p: any) => p.isActive)
          .map((p: any) => ({
            id: p._id,
            name: p.name,
            type: p.type as 'Service' | 'Product',
            category: p.category,
            price: p.price,
            administrationRoute: p.administrationRoute,
          }))

        const vaccineTypes: CatalogEntry[] = (vtRes?.data?.vaccineTypes ?? [])
          .filter((v: any) => v.isActive)
          .map((v: any) => ({
            id: v._id,
            name: v.name,
            type: 'Vaccine' as const,
            category: 'Vaccines',
            price: v.pricePerDose,
          }))

        const allCatalog = [...productServices, ...vaccineTypes]
        setCatalog(allCatalog)

        // 2. Fetch vaccinations for this pet administered on the same day as the record
        const petObj = typeof record.petId === 'object' ? (record.petId as any) : null
        const petId = petObj?._id ?? record.petId
        let petVaccinations: any[] = []
        if (petId) {
          try {
            const vacRes = await authenticatedFetch(
              `/vaccinations/pet/${petId}`,
              { method: 'GET' },
              token,
            )
            const recordDate = new Date(record.createdAt)
            petVaccinations = (vacRes?.data?.vaccinations ?? []).filter((v: any) => {
              if (!v.dateAdministered) return false
              const vDate = new Date(v.dateAdministered)
              return (
                vDate.getFullYear() === recordDate.getFullYear() &&
                vDate.getMonth() === recordDate.getMonth() &&
                vDate.getDate() === recordDate.getDate()
              )
            })
          } catch {
            // non-fatal – vaccinations may not be available
          }
        }

        // 3. Auto-match record entries to catalog items
        const autoItems: BillingLineItem[] = []

        // Medications
        const medCatalog = allCatalog.filter((c) => c.category === 'Medication')
        for (const med of record.medications ?? []) {
          if (!med.name) continue
          const match =
            medCatalog.find(
              (c) =>
                normalizeName(c.name) === normalizeName(med.name) &&
                (!c.administrationRoute || c.administrationRoute === med.route),
            ) || matchByName(med.name, medCatalog)
          autoItems.push({
            tempId: nextTempId(),
            name: match ? match.name : med.name,
            price: match ? match.price : 0,
            type: 'Product',
            category: 'Medication',
            catalogId: match ? match.id : null,
            catalogKind: match ? 'product-service' : 'unmatched',
          })
        }

        // Diagnostic Tests
        const diagCatalog = allCatalog.filter((c) => c.category === 'Diagnostic Tests')
        for (const test of record.diagnosticTests ?? []) {
          if (!test.name) continue
          const match = matchByName(test.name, diagCatalog)
          autoItems.push({
            tempId: nextTempId(),
            name: match ? match.name : test.name,
            price: match ? match.price : 0,
            type: 'Service',
            category: 'Diagnostic Tests',
            catalogId: match ? match.id : null,
            catalogKind: match ? 'product-service' : 'unmatched',
          })
        }

        // Preventive Care
        const careCatalog = allCatalog.filter((c) => c.category === 'Preventive Care')
        for (const care of record.preventiveCare ?? []) {
          if (!care.product) continue
          const match = matchByName(care.product, careCatalog)
          autoItems.push({
            tempId: nextTempId(),
            name: match ? match.name : care.product,
            price: match ? match.price : 0,
            type: 'Service',
            category: 'Preventive Care',
            catalogId: match ? match.id : null,
            catalogKind: match ? 'product-service' : 'unmatched',
          })
        }

        // Vaccines administered on the same visit day
        for (const vax of petVaccinations) {
          const match = vaccineTypes.find(
            (v) => normalizeName(v.name) === normalizeName(vax.vaccineName),
          )
          autoItems.push({
            tempId: nextTempId(),
            name: match ? match.name : vax.vaccineName,
            price: match ? match.price : 0,
            type: 'Vaccine',
            category: 'Vaccines',
            catalogId: match ? match.id : null,
            catalogKind: match ? 'vaccine' : 'unmatched',
          })
        }

        setItems(autoItems)
      } catch (err) {
        console.error('BillingFromRecordModal fetch error:', err)
        toast.error('Failed to load catalog data')
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Add item from catalog ----
  const addCatalogItem = (entry: CatalogEntry) => {
    setItems((prev) => [
      ...prev,
      {
        tempId: nextTempId(),
        name: entry.name,
        price: entry.price,
        type: entry.type,
        category: entry.category,
        catalogId: entry.id,
        catalogKind: entry.type === 'Vaccine' ? 'vaccine' : 'product-service',
      },
    ])
    setAddSearch('')
    setShowAddPanel(false)
  }

  // ---- Remove item ----
  const removeItem = (tempId: string) => {
    setItems((prev) => prev.filter((i) => i.tempId !== tempId))
  }

  // ---- Filtered + grouped catalog for the add panel ----
  const filteredGrouped = useMemo(() => {
    const filtered = addSearch.trim()
      ? catalog.filter(
          (c) =>
            c.name.toLowerCase().includes(addSearch.toLowerCase()) ||
            c.category.toLowerCase().includes(addSearch.toLowerCase()),
        )
      : catalog
    return groupByCategoryOrdered(filtered)
  }, [addSearch, catalog])

  // ---- Save / create billing ----
  const handleSave = async () => {
    if (!record) {
      onClose()
      return
    }

    const itemsToSave = items.filter((item) => item.price >= 0)
    if (itemsToSave.length === 0) {
      toast.error('Add at least one service to create a billing record')
      return
    }

    setSaving(true)
    try {
      const pet = typeof record.petId === 'object' ? (record.petId as any) : { _id: record.petId }
      const vet = typeof record.vetId === 'object' ? (record.vetId as any) : { _id: record.vetId }
      const branch =
        typeof record.clinicBranchId === 'object'
          ? (record.clinicBranchId as any)
          : { _id: record.clinicBranchId }
      const apptId =
        typeof record.appointmentId === 'object'
          ? (record.appointmentId as any)?._id
          : record.appointmentId

      const billingItems = itemsToSave.map((item) => ({
        ...(item.catalogKind === 'product-service' && item.catalogId
          ? { productServiceId: item.catalogId }
          : {}),
        ...(item.catalogKind === 'vaccine' && item.catalogId
          ? { vaccineTypeId: item.catalogId }
          : {}),
        name: item.name,
        type: item.type === 'Vaccine' ? 'Service' : item.type,
        unitPrice: item.price,
      }))

      const res = await authenticatedFetch(
        '/billings',
        {
          method: 'POST',
          body: JSON.stringify({
            ownerId: pet.ownerId,
            petId: pet._id,
            vetId: vet._id,
            clinicBranchId: branch._id,
            medicalRecordId: record._id,
            appointmentId: apptId || null,
            items: billingItems,
          }),
        },
        token,
      )

      if (res.status === 'SUCCESS') {
        setSaved(true)
        toast.success('Billing created successfully')
        onBillingCreated?.(res.data?.billing?._id)
        setTimeout(() => {
          onClose()
          setSaved(false)
        }, 1200)
      } else {
        toast.error(res.message || 'Failed to create billing')
      }
    } catch (err) {
      console.error('Create billing error:', err)
      toast.error('An error occurred while creating billing')
    } finally {
      setSaving(false)
    }
  }

  const shortAppointmentId = appointmentId ? `#${appointmentId.slice(-8).toUpperCase()}` : '—'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-[#4F4F4F]">{MODAL_TITLES[mode]}</h2>
            <p className="text-sm text-gray-400 mt-0.5">Services acquired from medical record</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[#476B6B]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Matching services from record…</span>
            </div>
          ) : (
            <>
              {/* Items Table */}
              <div className="border border-gray-100 rounded-xl overflow-hidden mb-3">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                        Product / Service
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                        Category
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">
                        Price
                      </th>
                      {!isReadOnly && (
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={isReadOnly ? 3 : 4}
                          className="text-center py-8 text-gray-400 text-xs"
                        >
                          No services matched from this record.{' '}
                          {!isReadOnly && 'Use "Add Service" below to add items manually.'}
                        </td>
                      </tr>
                    ) : (
                      items.map((item) => (
                        <tr
                          key={item.tempId}
                          className="border-t border-gray-50 hover:bg-gray-50/50"
                        >
                          <td className="px-4 py-3 font-medium text-[#4F4F4F]">
                            {item.name}
                            {item.catalogId === null && (
                              <span className="ml-1.5 text-[10px] text-amber-500 font-normal bg-amber-50 px-1.5 py-0.5 rounded">
                                no price match
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs capitalize">
                            {item.category}
                          </td>
                          <td className="px-4 py-3 text-right text-[#4F4F4F]">
                            {item.catalogId === null ? (
                              <span className="text-amber-500 text-xs">₱ 0.00</span>
                            ) : (
                              formatCurrency(item.price)
                            )}
                          </td>
                          {!isReadOnly && (
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => removeItem(item.tempId)}
                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add Service panel */}
              {!isReadOnly && (
                <div className="mb-4">
                  {!showAddPanel ? (
                    <button
                      onClick={() => setShowAddPanel(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-[#476B6B] hover:text-[#3a5858] transition-colors py-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Service / Product
                    </button>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      {/* Search input */}
                      <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <input
                          type="text"
                          value={addSearch}
                          onChange={(e) => setAddSearch(e.target.value)}
                          placeholder="Search medications, services, vaccines…"
                          className="flex-1 text-xs bg-transparent outline-none text-[#4F4F4F] placeholder:text-gray-400"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            setShowAddPanel(false)
                            setAddSearch('')
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Results list grouped by category */}
                      <div className="max-h-52 overflow-y-auto">
                        {filteredGrouped.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-5">No results found</p>
                        ) : (
                          filteredGrouped.map(({ category, items: catItems }) => (
                            <div key={category}>
                              <div className="px-4 py-1.5 bg-gray-50 border-t border-gray-100">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                                  {category}
                                </p>
                              </div>
                              {catItems.map((entry) => (
                                <button
                                  key={entry.id}
                                  onClick={() => addCatalogItem(entry)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[#f0f7f7] text-left border-t border-gray-50 transition-colors"
                                >
                                  <p className="text-sm font-medium text-[#4F4F4F]">{entry.name}</p>
                                  <span className="text-xs font-semibold text-[#476B6B] shrink-0 ml-4">
                                    {formatCurrency(entry.price)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Order Summary + Record Info */}
              <div className="flex gap-3 mb-4">
                {/* Order Summary */}
                <div className="flex-1 border border-gray-100 rounded-xl p-4">
                  <p className="text-sm font-bold text-[#476B6B]">Order Summary</p>
                  <p className="text-xs text-gray-400 mb-3">Amount Due</p>
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#4F4F4F]">Total Amount Due</span>
                    <span className="text-sm font-bold text-[#476B6B]">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>

                {/* Record Info */}
                <div className="w-40 shrink-0 bg-[#f0f7f7] border border-[#c8e0df] rounded-xl p-4 space-y-3.5">
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <PawPrint className="w-3 h-3 text-[#476B6B]" />
                      <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wide">
                        Patient
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#4F4F4F] leading-tight">
                      {patientName || '—'}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Hash className="w-3 h-3 text-[#476B6B]" />
                      <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wide">
                        Appt. ID
                      </p>
                    </div>
                    <p className="text-xs font-mono text-[#4F4F4F] break-all leading-tight">
                      {shortAppointmentId}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Stethoscope className="w-3 h-3 text-[#476B6B]" />
                      <p className="text-[10px] font-semibold text-[#476B6B] uppercase tracking-wide">
                        Veterinarian
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#4F4F4F] leading-tight">
                      {vetName || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="flex justify-center mb-5">
                <span className="px-5 py-1.5 text-xs font-medium text-green-600 border border-green-200 bg-green-50 rounded-full">
                  For Veterinarian Approval
                </span>
              </div>

              {/* Actions */}
              {!isReadOnly && (
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving || saved}
                    className="px-8 py-2.5 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] disabled:opacity-60 transition-colors flex items-center gap-2"
                  >
                    {saved ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Saved
                      </>
                    ) : saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save Billing'
                    )}
                  </button>
                  <button
                    onClick={onClose}
                    className="px-8 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:border-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
