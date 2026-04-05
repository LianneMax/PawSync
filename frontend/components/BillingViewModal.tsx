'use client'

import React, { useState, useEffect } from 'react'
import { X, Printer, Download } from 'lucide-react'
import { refreshBillingPrices } from '@/lib/billingSync'
import { useAuthStore } from '@/store/authStore'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : ''
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

interface ApiBillingItem {
  _id: string
  productServiceId: string
  vaccineTypeId?: string
  name: string
  type: 'Service' | 'Product'
  unitPrice: number
  quantity: number
}

interface ApiBilling {
  _id: string
  invoiceNumber?: string
  issueDateTime?: string
  dueDate?: string
  ownerId: { _id: string; firstName: string; lastName: string; email: string }
  petId: { _id: string; name: string; species: string; breed: string }
  vetId: { _id: string; firstName: string; lastName: string }
  clinicId: { _id: string; name: string; legalBusinessName?: string; logo?: string; businessTaxId?: string; receiptFooterNote?: string; address?: string; phone?: string; email?: string }
  clinicBranchId: { _id: string; name: string; address?: string; city?: string; province?: string; phone?: string; email?: string }
  medicalRecordId: { _id: string; stage: string } | null
  items: ApiBillingItem[]
  subtotal: number
  discount: number
  totalAmountDue: number
  status: 'pending_payment' | 'paid'
  serviceLabel: string
  serviceDate: string
  createdAt: string
  paidAt?: string
  amountPaid?: number
  paymentMethod?: 'cash' | 'card' | 'qr'
}

type AdminStatus = 'Running' | 'Paid' | 'Pending Payment'

function isPayableBilling(billing: ApiBilling): boolean {
  if (billing.status !== 'pending_payment') return false
  if (!billing.medicalRecordId) return true
  return billing.medicalRecordId.stage === 'completed'
}

function mapAdminStatus(billing: ApiBilling): AdminStatus {
  if (billing.status === 'paid') return 'Paid'
  if (isPayableBilling(billing)) return 'Pending Payment'
  return 'Running'
}

function getAdminStatusStyle(status: AdminStatus) {
  switch (status) {
    case 'Paid': return 'bg-green-100 text-green-700'
    case 'Pending Payment': return 'bg-blue-100 text-blue-700'
    case 'Running': return 'bg-yellow-100 text-yellow-700'
    default: return 'bg-gray-100 text-[#4F4F4F]'
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const CATEGORY_ORDER = ['Medication', 'Diagnostic Tests', 'Preventive Care', 'Surgeries', 'Pregnancy Delivery', 'Vaccines', 'Others']

function groupBillingItemsByCategory(
  items: ApiBillingItem[],
  categoryMap: Map<string, string>,
): { category: string; items: ApiBillingItem[] }[] {
  const map = new Map<string, ApiBillingItem[]>()
  for (const item of items) {
    const cat = item.vaccineTypeId
      ? 'Vaccines'
      : (item.productServiceId ? (categoryMap.get(item.productServiceId) ?? 'Others') : 'Others')
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(item)
  }
  const result: { category: string; items: ApiBillingItem[] }[] = []
  for (const cat of CATEGORY_ORDER) {
    if (map.has(cat)) result.push({ category: cat, items: map.get(cat)! })
  }
  for (const [cat, catItems] of map) {
    if (!CATEGORY_ORDER.includes(cat)) result.push({ category: cat, items: catItems })
  }
  return result
}

export default function BillingViewModal({
  billingId,
  onClose,
}: {
  billingId: string
  onClose: () => void
}) {
  const PAYMENT_METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', qr: 'QR' }
  const { token } = useAuthStore()
  const [billing, setBilling] = useState<ApiBilling | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [pdfLayout, setPdfLayout] = useState<'a4' | 'thermal-80' | 'thermal-58'>('a4')
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map())

  const fetchReceiptBlob = async (layout: 'a4' | 'thermal-80' | 'thermal-58' = 'a4') => {
    if (!billing) return
    const res = await fetch(`${API_BASE}/billings/${billing._id}/download-pdf?layout=${layout}`, {
      headers: authHeaders(),
    })
    if (!res.ok) throw new Error('Failed to download receipt')
    return res.blob()
  }

  const downloadPdf = async (layout: 'a4' | 'thermal-80' | 'thermal-58' = 'a4') => {
    if (!billing) return
    setDownloading(true)
    try {
      const blob = await fetchReceiptBlob(layout)
      if (!blob) return
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const issue = new Date(billing.issueDateTime || billing.createdAt).toISOString().slice(0, 10).replace(/-/g, '')
      a.href = url
      a.download = `receipt-${billing.invoiceNumber || billing._id}-${issue}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      window.alert('Unable to download receipt PDF right now.')
    } finally {
      setDownloading(false)
    }
  }

  const printReceipt = async (layout: 'a4' | 'thermal-80' | 'thermal-58' = 'a4') => {
    if (!billing) return
    setPrinting(true)
    try {
      const blob = await fetchReceiptBlob(layout)
      if (!blob) return
      const url = window.URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      if (!printWindow) {
        window.alert('Please allow pop-ups to print the receipt.')
        window.URL.revokeObjectURL(url)
        return
      }
      const cleanup = () => window.URL.revokeObjectURL(url)
      printWindow.addEventListener('afterprint', cleanup, { once: true })
      setTimeout(() => {
        try {
          printWindow.focus()
          printWindow.print()
        } catch {
          cleanup()
        }
      }, 500)
    } catch (error) {
      console.error(error)
      window.alert('Unable to print receipt right now.')
    } finally {
      setPrinting(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const [billingRes, psRes, vtRes] = await Promise.all([
          fetch(`${API_BASE}/billings/${billingId}`, { headers: authHeaders() }).then((r) => r.json()),
          fetch(`${API_BASE}/product-services`, { headers: authHeaders() }).then((r) => r.json()),
          fetch(`${API_BASE}/vaccine-types`).then((r) => r.json()),
        ])
        if (billingRes.status === 'SUCCESS') {
          setBilling(billingRes.data.billing)
        }
        const map = new Map<string, string>()
        for (const p of psRes?.data?.items ?? []) map.set(p._id, p.category)
        for (const v of vtRes?.data?.vaccineTypes ?? []) map.set(v._id, 'Vaccines')
        setCategoryMap(map)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [billingId])

  // Refresh prices for unpaid bills
  useEffect(() => {
    if (!billing || billing.status === 'paid' || !token) return
    refreshBillingPrices(billing._id, token)
      .then((updated) => { if (updated) setBilling(updated as ApiBilling) })
      .catch(() => {})
  }, [billing?._id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 text-center">
          <p className="text-gray-400 text-sm">Loading billing details...</p>
        </div>
      </div>
    )
  }

  if (!billing) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 text-center">
          <p className="text-[#900B09] text-sm">Failed to load billing details.</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-[#3D5E5C] text-white rounded-xl text-sm"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const modalStatus = mapAdminStatus(billing)
  const groupedItems = groupBillingItemsByCategory(billing.items, categoryMap)

  const branch = billing.clinicBranchId
  const clinic = billing.clinicId
  const branchAddressParts = [branch?.address, branch?.city, branch?.province].filter(Boolean)
  const displayAddress = branchAddressParts.length > 0 ? branchAddressParts.join(', ') : clinic?.address
  const displayPhone = branch?.phone || clinic?.phone
  const displayEmail = branch?.email || clinic?.email

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm billing-print-root"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 relative max-h-[92vh] overflow-y-auto billing-print-document ${
          pdfLayout === 'thermal-58' ? 'billing-print-thermal-58' : pdfLayout === 'thermal-80' ? 'billing-print-thermal-80' : 'billing-print-a4'
        }`}
      >
        {/* Sticky action bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-4 pb-3 rounded-t-2xl flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="text-base font-bold text-[#4F4F4F] whitespace-nowrap">Billing Receipt</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getAdminStatusStyle(modalStatus)}`}>
              {modalStatus}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={pdfLayout}
              onChange={(e) => setPdfLayout(e.target.value as 'a4' | 'thermal-80' | 'thermal-58')}
              className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white"
            >
              <option value="a4">A4</option>
              <option value="thermal-80">Thermal 80mm</option>
              <option value="thermal-58">Thermal 58mm</option>
            </select>
            <button
              onClick={() => printReceipt(pdfLayout)}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-[#4F4F4F] hover:bg-gray-50 disabled:opacity-60 font-medium rounded-lg transition-colors text-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              {printing ? 'Preparing...' : 'Print'}
            </button>
            <button
              onClick={() => downloadPdf(pdfLayout)}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#3D5E5C] text-[#3D5E5C] hover:bg-[#f0f7f7] disabled:opacity-60 font-medium rounded-lg transition-colors text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Downloading...' : 'Download'}
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt body */}
        <div className="px-6 py-5 space-y-5">

          {/* Clinic / Branch header */}
          <div className="rounded-xl overflow-hidden border border-[#3D5E5C]/20">
            <div className="bg-[#3D5E5C] px-5 py-4 flex items-start gap-4">
              {clinic?.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clinic.logo} alt="Clinic logo" className="w-12 h-12 rounded-lg object-contain bg-white/10 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-base leading-tight truncate">{clinic?.name || 'Clinic'}</p>
                {branch?.name && (
                  <p className="text-[#a8c5c3] text-xs mt-0.5 truncate">{branch.name}</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[#a8c5c3] text-[10px] uppercase tracking-wide">Invoice No.</p>
                <p className="text-white font-bold text-sm mt-0.5">{billing.invoiceNumber || billing._id}</p>
              </div>
            </div>
            <div className="bg-[#f4f9f8] px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[#4F4F4F]">
              {displayAddress && (
                <span className="flex items-start gap-1">
                  <span className="text-[#3D5E5C] font-medium mt-0.5">📍</span>
                  <span>{displayAddress}</span>
                </span>
              )}
              {displayPhone && (
                <span className="flex items-center gap-1">
                  <span className="text-[#3D5E5C] font-medium">📞</span>
                  <span>{displayPhone}</span>
                </span>
              )}
              {displayEmail && (
                <span className="flex items-center gap-1">
                  <span className="text-[#3D5E5C] font-medium">✉️</span>
                  <span>{displayEmail}</span>
                </span>
              )}
            </div>
          </div>

          {/* Status banners */}
          {billing.status === 'pending_payment' && billing.medicalRecordId && billing.medicalRecordId.stage !== 'completed' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
              The visit is still in progress. This invoice will update automatically as the medical record is completed.
            </div>
          )}
          {isPayableBilling(billing) && !billing.medicalRecordId && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              This invoice is ready for payment.
            </div>
          )}
          {billing.status === 'pending_payment' && billing.medicalRecordId?.stage === 'completed' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              The visit is complete. This invoice is ready for payment.
            </div>
          )}

          {/* Patient & visit info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 bg-gray-50 rounded-xl px-4 py-3 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Patient</p>
                <p className="text-sm font-semibold text-[#4F4F4F]">{billing.petId?.name || '-'}</p>
                {billing.petId?.breed && (
                  <p className="text-xs text-gray-400">{billing.petId.species} · {billing.petId.breed}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Owner</p>
                <p className="text-sm font-semibold text-[#4F4F4F]">{billing.ownerId?.firstName} {billing.ownerId?.lastName}</p>
                {billing.vetId?.firstName && (
                  <p className="text-xs text-gray-400">Dr. {billing.vetId.firstName} {billing.vetId.lastName}</p>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Issue Date</p>
              <p className="text-sm font-semibold text-[#4F4F4F] mt-0.5">
                {new Date(billing.issueDateTime || billing.createdAt).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Due Date</p>
              <p className="text-sm font-semibold text-[#4F4F4F] mt-0.5">{formatDate(billing.dueDate || billing.serviceDate || billing.createdAt)}</p>
            </div>
            {billing.serviceLabel && (
              <div className="col-span-2 bg-gray-50 rounded-xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Service</p>
                <p className="text-sm font-semibold text-[#4F4F4F] mt-0.5">{billing.serviceLabel}</p>
              </div>
            )}
          </div>

          {/* Items table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#3D5E5C]">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-white">Product / Service</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-white">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-white">Unit Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-white">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {billing.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No items yet</td>
                  </tr>
                ) : (
                  groupedItems.map(({ category, items: catItems }) => (
                    <React.Fragment key={category}>
                      <tr>
                        <td colSpan={4} className="px-4 py-1.5 bg-[#f4f9f8] border-t border-gray-100">
                          <p className="text-[10px] font-bold text-[#3D5E5C] uppercase tracking-wide">{category}</p>
                        </td>
                      </tr>
                      {catItems.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-[#4F4F4F]">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-500">{item.quantity ?? 1}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">₱{item.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-[#4F4F4F]">
                            ₱{((item.unitPrice ?? 0) * (item.quantity ?? 1)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Order summary */}
          <div className="rounded-xl overflow-hidden border border-gray-200">
            <div className="px-4 py-3 space-y-2 bg-gray-50">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-[#4F4F4F] font-medium">₱{billing.subtotal.toLocaleString()}</span>
              </div>
              {billing.discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-[#900B09] font-medium">- ₱{billing.discount.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="bg-[#3D5E5C] px-4 py-3 flex justify-between items-center">
              <span className="text-white font-bold text-sm">Total Amount Due</span>
              <span className="text-white font-bold text-lg">₱{billing.totalAmountDue.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment details */}
          {billing.status === 'paid' ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                <p className="text-sm font-bold text-green-700">Payment Received</p>
              </div>
              {billing.amountPaid !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="text-green-700 font-semibold">₱{billing.amountPaid.toLocaleString()}</span>
                </div>
              )}
              {billing.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Method</span>
                  <span className="text-[#4F4F4F] font-medium">{PAYMENT_METHOD_LABEL[billing.paymentMethod] ?? billing.paymentMethod}</span>
                </div>
              )}
              {billing.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid On</span>
                  <span className="text-[#4F4F4F]">{formatDate(billing.paidAt)}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-500">Payment Status</span>
              <span className="font-semibold text-[#4F4F4F]">Pending Payment</span>
            </div>
          )}

          {/* Footer note */}
          <p className="text-center text-[10px] text-gray-400 pb-1">
            {clinic?.receiptFooterNote || 'This receipt is system-generated and valid without signature.'}
          </p>
        </div>

        {/* Bottom close row (mobile) */}
        <div className="px-6 pb-5 flex justify-end print:hidden">
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-[#3D5E5C] hover:bg-[#2F4C4A] text-white font-semibold rounded-xl transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
