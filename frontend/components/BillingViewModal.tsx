'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
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
  ownerId: { _id: string; firstName: string; lastName: string; email: string }
  petId: { _id: string; name: string; species: string; breed: string }
  vetId: { _id: string; firstName: string; lastName: string }
  clinicId: { _id: string; name: string }
  clinicBranchId: { _id: string; name: string }
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
  const [categoryMap, setCategoryMap] = useState<Map<string, string>>(new Map())

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
          <p className="text-red-500 text-sm">Failed to load billing details.</p>
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 relative max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 pt-5 pb-4 rounded-t-2xl">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-[#4F4F4F]">Billing Details</h2>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAdminStatusStyle(modalStatus)}`}>
                  {modalStatus}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5 truncate">
                <span className="font-medium text-[#4F4F4F]">{billing.petId?.name}</span>
                {billing.petId?.breed ? (
                  <span className="text-gray-400"> · {billing.petId.species} {billing.petId.breed}</span>
                ) : null}
                {' '}&mdash;{' '}
                {billing.ownerId?.firstName} {billing.ownerId?.lastName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            {billing.vetId?.firstName && (
              <span>Dr. {billing.vetId.firstName} {billing.vetId.lastName}</span>
            )}
            {(billing.serviceDate || billing.createdAt) && (
              <span>{formatDate(billing.serviceDate || billing.createdAt)}</span>
            )}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
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

          {/* Items table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Product / Service</th>
                  <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500">Total</th>
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
                        <td colSpan={4} className="px-4 py-1.5 bg-gray-50 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{category}</p>
                        </td>
                      </tr>
                      {catItems.map((item) => (
                        <tr key={item._id}>
                          <td className="px-4 py-3 text-sm font-medium text-[#4F4F4F]">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-center text-[#4F4F4F]">{item.quantity ?? 1}</td>
                          <td className="px-4 py-3 text-sm text-right text-[#4F4F4F]">₱{item.unitPrice.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-[#4F4F4F]">
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
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-[#4F4F4F] font-medium">₱{billing.subtotal.toLocaleString()}</span>
            </div>
            {billing.discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Discount</span>
                <span className="text-red-500 font-medium">-₱{billing.discount.toLocaleString()}</span>
              </div>
            )}
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
              <span className="text-[#3D5A58]">Total Amount Due</span>
              <span className="text-[#3D5A58] text-base">₱{billing.totalAmountDue.toLocaleString()}</span>
            </div>
          </div>

          {/* Payment details (paid only) */}
          {billing.status === 'paid' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-green-700 mb-1">Payment Received</p>
              {billing.amountPaid !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="text-green-700 font-medium">₱{billing.amountPaid.toLocaleString()}</span>
                </div>
              )}
              {billing.paymentMethod && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="text-[#4F4F4F]">{PAYMENT_METHOD_LABEL[billing.paymentMethod] ?? billing.paymentMethod}</span>
                </div>
              )}
              {billing.paidAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid On</span>
                  <span className="text-[#4F4F4F]">{formatDate(billing.paidAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-5 flex justify-end">
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
