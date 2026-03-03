'use client'

import { useState } from 'react'
import { X, Search, Pencil, PawPrint, Stethoscope, Hash } from 'lucide-react'

interface BillingItem {
  id: string
  name: string
  price: number
}

interface BillingFromRecordModalProps {
  open: boolean
  mode: 'create' | 'view' | 'update'
  onClose: () => void
  patientName: string
  appointmentId: string | null
  vetName: string
}

const MODAL_TITLES: Record<BillingFromRecordModalProps['mode'], string> = {
  create: 'Create Billing',
  view: 'View Billing',
  update: 'Update Billing',
}

function formatCurrency(amount: number) {
  return `P ${amount.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
}

export default function BillingFromRecordModal({
  open,
  mode,
  onClose,
  patientName,
  appointmentId,
  vetName,
}: BillingFromRecordModalProps) {
  const [items, setItems] = useState<BillingItem[]>([])
  const [search, setSearch] = useState('')
  const [discount] = useState(0)

  const isReadOnly = mode === 'view'
  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const total = Math.max(0, subtotal - discount)

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const shortAppointmentId = appointmentId
    ? `#${appointmentId.slice(-8).toUpperCase()}`
    : '—'

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="text-center mb-5">
            <h2 className="text-xl font-bold text-[#4F4F4F]">
              {MODAL_TITLES[mode]}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Billing pulled from medical Record
            </p>
          </div>

          {/* Search */}
          {!isReadOnly && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Product/Service to Add"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#476B6B] bg-gray-50 placeholder:text-gray-400"
              />
            </div>
          )}

          {/* Items Table */}
          <div className="border border-gray-100 rounded-xl overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                    Product / Service
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
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
                      colSpan={isReadOnly ? 2 : 3}
                      className="text-center py-8 text-gray-400 text-xs"
                    >
                      No items added yet
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-[#4F4F4F]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-[#4F4F4F]">
                        Php {item.price.toLocaleString('en-PH')}
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button className="p-1.5 text-gray-400 hover:text-[#476B6B] hover:bg-[#f0f7f7] rounded-lg transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Order Summary + Record Info */}
          <div className="flex gap-3 mb-4">
            {/* Order Summary */}
            <div className="flex-1 border border-gray-100 rounded-xl p-4">
              <p className="text-sm font-bold text-[#476B6B]">Order Summary</p>
              <p className="text-xs text-gray-400 mb-3">Amount Due</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Services / Products Fee</span>
                  <span className="font-medium text-[#4F4F4F] text-xs">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Discount</span>
                  <span className="font-medium text-red-400 text-xs">
                    -{formatCurrency(discount)}
                  </span>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between items-center">
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

          {/* For Veterinarian Approval badge */}
          <div className="flex justify-center mb-5">
            <span className="px-5 py-1.5 text-xs font-medium text-green-600 border border-green-200 bg-green-50 rounded-full">
              For Veterinarian Approval
            </span>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-3">
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-[#476B6B] text-white rounded-xl text-sm font-medium hover:bg-[#3a5858] transition-colors"
            >
              Save
            </button>
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
