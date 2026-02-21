'use client'

import { useEffect } from 'react'

interface NFCLinkModalProps {
  isOpen: boolean
  url: string | null
  onClose: () => void
}

export function NFCLinkModal({ isOpen, url, onClose }: NFCLinkModalProps) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleOpenLink = () => {
    if (url) {
      // Ensure URL has protocol
      const fullUrl = url.startsWith('http') ? url : `https://${url}`
      window.open(fullUrl, '_blank')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg">
        <h2 className="text-xl font-bold mb-4">NFC Card Detected</h2>
        
        <div className="mb-6">
          <p className="text-gray-600 mb-2">Link from NFC tag:</p>
          <div className="bg-gray-100 p-3 rounded break-all text-sm font-mono">
            {url || 'No URL found'}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
          >
            Close
          </button>
          <button
            onClick={handleOpenLink}
            disabled={!url}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            Open Link
          </button>
        </div>
      </div>
    </div>
  )
}
