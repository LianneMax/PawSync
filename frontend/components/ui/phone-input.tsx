'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const phoneInputVariants = cva(
  'flex items-center w-full rounded-xl border border-gray-200 bg-white text-sm text-[#4F4F4F] shadow-sm transition-all focus-within:border-[#7FA5A3] focus-within:ring-2 focus-within:ring-[#7FA5A3]/20',
  {
    variants: {
      variant: {
        lg: 'h-12 px-4',
        default: 'h-11 px-4',
        sm: 'h-9 px-3 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface PhoneInputProps extends VariantProps<typeof phoneInputVariants> {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

// Reduce any stored form (+639XXXXXXXXX, 09XXXXXXXXX, 9XXXXXXXXX) to the 10 local digits.
// +63 is shown as a fixed badge, so it never appears in the field itself.
function toLocalDigits(raw?: string): string {
  let digits = (raw ?? '').replace(/\D/g, '')
  if (digits.startsWith('63')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 10)
}

// Group PH mobile digits as 9XX XXX XXXX (3-3-4).
function formatLocal(digits: string): string {
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
  return parts.filter(Boolean).join(' ')
}

function PhoneInput({
  className,
  variant,
  placeholder = '9XX XXX XXXX',
  disabled,
  value,
  onChange,
}: PhoneInputProps) {
  const displayValue = formatLocal(toLocalDigits(value))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = toLocalDigits(e.target.value)
    // Store E.164; +63 lives only in the badge, never doubled into the value
    onChange?.(digits ? `+63${digits}` : '')
  }

  return (
    <div className={cn(phoneInputVariants({ variant, className }))}>
      <span className="flex items-center gap-1.5 pr-3 border-r border-gray-200 shrink-0 select-none">
        🇵🇭 <span className="font-medium text-[#4F4F4F]">+63</span>
      </span>
      <input
        type="tel"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 ml-3 bg-transparent outline-none border-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  )
}

export { PhoneInput }
