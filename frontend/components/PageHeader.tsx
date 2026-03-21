import React from 'react'

interface PageHeaderProps {
  title: string
  subtitle: string
  className?: string
}

export default function PageHeader({ title, subtitle, className = '' }: PageHeaderProps) {
  return (
    <div className={className}>
      <h1
        className="text-[32px] text-[#476B6B]"
        style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
      >
        {title}
      </h1>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  )
}
