'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { getPetById, type Pet as APIPet } from '@/lib/pets'
import { ArrowLeft, Nfc, AlertTriangle, RefreshCw, Plus } from 'lucide-react'

export default function NfcManagePage() {
  const router = useRouter()
  const params = useParams()
  const petId = params.id as string
  const token = useAuthStore((state) => state.token)
  const [pet, setPet] = useState<APIPet | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPet = useCallback(async () => {
    if (!token || !petId) return
    try {
      setLoading(true)
      const response = await getPetById(petId, token)
      if (response.status === 'SUCCESS' && response.data?.pet) {
        setPet(response.data.pet)
      }
    } catch (error) {
      console.error('Failed to fetch pet:', error)
    } finally {
      setLoading(false)
    }
  }, [token, petId])

  useEffect(() => {
    fetchPet()
  }, [fetchPet])

  const hasTag = !!pet?.nfcTagId

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-2xl">
        <button
          onClick={() => router.push('/my-pets')}
          className="flex items-center gap-2 text-gray-600 hover:text-[#4F4F4F] mb-6 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Pets
        </button>

        <h1
          className="text-[32px] text-[#476B6B] mb-2"
          style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
        >
          NFC Tag Management
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          {pet ? `Manage the NFC tag for ${pet.name}` : 'Loading...'}
        </p>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 h-24 animate-pulse" />
            ))}
          </div>
        ) : pet ? (
          <div className="space-y-4">
            {/* Current Tag Status */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasTag ? 'bg-[#E8F5E9]' : 'bg-gray-100'}`}>
                  <Nfc className={`w-5 h-5 ${hasTag ? 'text-[#4CAF50]' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="font-semibold text-[#4F4F4F]">Tag Status</p>
                  <p className="text-sm text-gray-500">
                    {hasTag ? `Tag ID: ${pet.nfcTagId}` : 'No NFC tag registered'}
                  </p>
                </div>
                <span className={`ml-auto text-xs font-semibold px-3 py-1 rounded-full ${
                  hasTag ? 'bg-[#E8F5E9] text-[#4CAF50]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {hasTag ? 'Active' : 'None'}
                </span>
              </div>
            </div>

            {/* Register NFC Tag */}
            {!hasTag && (
              <button className="w-full bg-white rounded-2xl border-2 border-dashed border-[#7FA5A3] p-6 text-left hover:bg-[#F8F6F2] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#7FA5A3]/10 rounded-xl flex items-center justify-center group-hover:bg-[#7FA5A3]/20 transition-colors">
                    <Plus className="w-6 h-6 text-[#7FA5A3]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#476B6B] text-base">Register an NFC Tag</p>
                    <p className="text-sm text-gray-500">Scan or enter a tag ID to link to {pet.name}</p>
                  </div>
                </div>
              </button>
            )}

            {/* Report Tag Lost */}
            {hasTag && (
              <button className="w-full bg-white rounded-2xl border border-gray-200 p-6 text-left hover:bg-red-50 hover:border-red-200 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center group-hover:bg-red-100 transition-colors">
                    <AlertTriangle className="w-6 h-6 text-[#900B09]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#4F4F4F] text-base">Report Tag as Lost</p>
                    <p className="text-sm text-gray-500">Deactivate the current tag and mark it as lost</p>
                  </div>
                </div>
              </button>
            )}

            {/* Issue Replacement */}
            {hasTag && (
              <button className="w-full bg-white rounded-2xl border border-gray-200 p-6 text-left hover:bg-[#F8F6F2] hover:border-[#7FA5A3] transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F8F6F2] rounded-xl flex items-center justify-center group-hover:bg-[#7FA5A3]/15 transition-colors">
                    <RefreshCw className="w-6 h-6 text-[#7FA5A3]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#4F4F4F] text-base">Issue a Replacement</p>
                    <p className="text-sm text-gray-500">Replace the current tag with a new one</p>
                  </div>
                </div>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
