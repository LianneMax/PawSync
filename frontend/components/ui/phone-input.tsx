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

function PhoneInput({
  className,
  variant,
  placeholder = '9XX XXX XXXX',
  disabled,
  value,
  onChange,
}: PhoneInputProps) {
  // value is stored as E.164 (+639XXXXXXXXX); strip +63 for display
  const displayValue = value?.startsWith('+63') ? value.slice(3) : (value ?? '')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '')
    // Strip leading 0 (e.g. 09XX → 9XX) then prepend +63
    const normalized = digits.startsWith('0') ? digits.slice(1) : digits
    onChange?.(normalized ? `+63${normalized}` : '')
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
