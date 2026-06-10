'use client'

import { forwardRef, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Eraser, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { uploadImage } from '@/lib/upload'

export interface SignatureCaptureHandle {
  /**
   * Resolves to the URL of the signature to use, or null if nothing was
   * drawn/selected/uploaded. If "Draw New Signature" is active, the canvas
   * is uploaded and the resulting URL is returned.
   */
  getSignatureUrl: () => Promise<string | null>
  reset: () => void
}

interface SignatureCaptureProps {
  savedSignatureUrl?: string | null
}

type SignatureMode = 'saved' | 'draw' | 'upload'

const SignatureCapture = forwardRef<SignatureCaptureHandle, SignatureCaptureProps>(
  ({ savedSignatureUrl }, ref) => {
    const [mode, setMode] = useState<SignatureMode>(savedSignatureUrl ? 'saved' : 'draw')
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const padRef = useRef<SignatureCanvas | null>(null)

    useImperativeHandle(ref, () => ({
      getSignatureUrl: async () => {
        if (mode === 'saved') {
          return savedSignatureUrl || null
        }
        if (mode === 'upload') {
          return uploadedUrl || null
        }
        if (!padRef.current || padRef.current.isEmpty()) {
          return null
        }
        const dataUrl = padRef.current.toDataURL('image/png')
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], 'signature.png', { type: 'image/png' })
        return uploadImage(file, 'signatures')
      },
      reset: () => {
        padRef.current?.clear()
        setUploadedUrl(null)
        setUploading(false)
        setMode(savedSignatureUrl ? 'saved' : 'draw')
      },
    }))

    const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }
      setUploading(true)
      try {
        const url = await uploadImage(file, 'signatures')
        setUploadedUrl(url)
      } catch {
        toast.error('Failed to upload signature image')
      } finally {
        setUploading(false)
      }
    }

    return (
      <div className="space-y-3">
        <div className="flex gap-2">
          {savedSignatureUrl && (
            <button
              type="button"
              onClick={() => setMode('saved')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                mode === 'saved'
                  ? 'bg-[#476B6B] text-white border-[#476B6B]'
                  : 'bg-white text-[#4F4F4F] border-gray-200 hover:bg-gray-50'
              }`}
            >
              Saved Signature
            </button>
          )}
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              mode === 'draw'
                ? 'bg-[#476B6B] text-white border-[#476B6B]'
                : 'bg-white text-[#4F4F4F] border-gray-200 hover:bg-gray-50'
            }`}
          >
            Draw New
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              mode === 'upload'
                ? 'bg-[#476B6B] text-white border-[#476B6B]'
                : 'bg-white text-[#4F4F4F] border-gray-200 hover:bg-gray-50'
            }`}
          >
            Upload Image
          </button>
        </div>

        {mode === 'saved' && savedSignatureUrl && (
          <div className="border border-gray-200 rounded-lg bg-[#F8F6F2] flex items-center justify-center h-32">
            <img src={savedSignatureUrl} alt="Saved signature" className="max-h-24 object-contain" />
          </div>
        )}

        {mode === 'draw' && (
          <div className="space-y-2">
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
              <SignatureCanvas
                ref={padRef}
                penColor="#4F4F4F"
                canvasProps={{ className: 'w-full h-32' }}
              />
            </div>
            <button
              type="button"
              onClick={() => padRef.current?.clear()}
              className="flex items-center gap-1.5 text-xs font-medium text-[#476B6B] hover:text-[#35514f] transition-colors"
            >
              <Eraser className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        )}

        {mode === 'upload' && (
          uploadedUrl ? (
            <div className="relative border border-gray-200 rounded-lg bg-[#F8F6F2] flex items-center justify-center h-32">
              <img src={uploadedUrl} alt="Uploaded signature" className="max-h-24 object-contain" />
              <button
                type="button"
                onClick={() => setUploadedUrl(null)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-500 flex items-center justify-center hover:bg-gray-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label
              className={`flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed transition-colors gap-1.5 ${
                uploading
                  ? 'border-gray-200 bg-gray-50 cursor-wait'
                  : 'border-gray-300 hover:border-[#7FA5A3] bg-gray-50 hover:bg-[#7FA5A3]/5 cursor-pointer'
              }`}
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <span className="text-xs text-gray-500">{uploading ? 'Uploading...' : 'Click to upload an image'}</span>
              <span className="text-[10px] text-gray-400">PNG or JPG</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={handleFileUpload}
              />
            </label>
          )
        )}
      </div>
    )
  }
)

SignatureCapture.displayName = 'SignatureCapture'

export default SignatureCapture
