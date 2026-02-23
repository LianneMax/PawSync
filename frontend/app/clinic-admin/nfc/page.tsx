'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { useAuthStore } from '@/store/authStore'
import { authenticatedFetch } from '@/lib/auth'
import {
  Nfc,
  Search,
  AlertCircle,
  Check,
  Loader,
  Activity,
  PawPrint,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'

interface Pet {
  _id: string
  name: string
  species: 'dog' | 'cat'
  breed: string
  photo?: string
  nfcTagId?: string
  owner: {
    firstName: string
    lastName: string
    email: string
    mobileNumber: string
  }
}

interface NfcStatus {
  petId: string
  hasNFCTag: boolean
  nfcTagId: string | null
}

interface WriteOperation {
  petId: string
  petName: string
  status: 'idle' | 'writing' | 'success' | 'error'
  nfcTagId?: string
  error?: string
  url?: string
}

interface TagRequest {
  _id: string
  petId: {
    _id: string
    name: string
    species: string
    breed: string
    photo?: string
  }
  ownerId: {
    firstName: string
    lastName: string
    email: string
    contactNumber?: string
  }
  reason: string
  status: 'pending' | 'fulfilled' | 'cancelled'
  createdAt: string
}

export default function ClinicNfcManagementPage() {
  const router = useRouter()
  const token = useAuthStore((state) => state.token)
  const userType = useAuthStore((state) => state.user?.userType)

  const [searchQuery, setSearchQuery] = useState('')
  const [pets, setPets] = useState<Pet[]>([])
  const [searching, setSearching] = useState(false)

  const [currentWrite, setCurrentWrite] = useState<WriteOperation | null>(null)
  const [nfcStatus, setNfcStatus] = useState<NfcStatus[]>([])
  const [readerStatus, setReaderStatus] = useState('Checking...')
  const [readerAvailable, setReaderAvailable] = useState(false)

  const [pendingRequests, setPendingRequests] = useState<TagRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<TagRequest | null>(null)

  const [writeStage, setWriteStage] = useState<string>('idle')
  const writeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Connect WebSocket for real-time NFC events
  useEffect(() => {
    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001').replace(/^http/, 'ws').replace(/\/api$/, '')
    const ws = new WebSocket(`${wsUrl}/ws/nfc`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'write:progress') {
          setWriteStage(msg.data.stage)
        }

        if (msg.type === 'write:complete') {
          if (msg.data.writeSuccess) {
            setWriteStage('success')
          } else {
            setWriteStage('failed')
          }
        }

        if (msg.type === 'reader:connect') {
          setReaderAvailable(true)
          setReaderStatus(`Reader connected: ${msg.data.name}`)
        }

        if (msg.type === 'reader:disconnect') {
          setReaderAvailable(false)
          setReaderStatus('NFC reader disconnected')
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected from NFC WebSocket')
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  // Check if user has access
  useEffect(() => {
    if (userType && (userType === 'pet-owner' || userType === 'veterinarian')) {
      router.push('/dashboard')
    }
  }, [userType, router])

  // Check NFC reader status
  useEffect(() => {
    const checkNfcStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
        const response = await fetch(`${apiUrl}/nfc/status`)
        const data = await response.json()

        if (data.success && data.data.initialized) {
          setReaderAvailable(true)
          setReaderStatus(`${data.data.readerCount} reader(s) connected`)
        } else {
          setReaderAvailable(false)
          setReaderStatus('No NFC reader detected')
        }
      } catch {
        setReaderAvailable(false)
        setReaderStatus('Unable to check NFC status')
      }
    }

    checkNfcStatus()
    const interval = setInterval(checkNfcStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  // Fetch pending tag requests
  useEffect(() => {
    const fetchPendingRequests = async () => {
      if (!token) return
      setLoadingRequests(true)
      try {
        const response = await authenticatedFetch(
          `/nfc/clinic/pending-requests`,
          { method: 'GET' },
          token
        )

        const data = response
        if (data.status === 'SUCCESS' && data.data?.requests) {
          setPendingRequests(data.data.requests)
        } else {
          setPendingRequests([])
        }
      } catch (error) {
        console.error('Failed to fetch pending requests:', error)
        setPendingRequests([])
      } finally {
        setLoadingRequests(false)
      }
    }

    const interval = setInterval(fetchPendingRequests, 5000)
    fetchPendingRequests()
    return () => clearInterval(interval)
  }, [token])

  // Search for pets
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim() || !token) return

    setSearching(true)
    try {
      const response = await authenticatedFetch(
        `/pets/search?q=${encodeURIComponent(searchQuery)}`,
        { method: 'GET' },
        token
      )

      const data = response

      if (data.status === 'SUCCESS' && data.data?.pets) {
        setPets(data.data.pets)

        // Fetch NFC status for each pet
        const statuses = await Promise.all(
          data.data.pets.map(async (pet: Pet) => {
            try {
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
              const statusRes = await fetch(
                `${apiUrl}/nfc/pet/${pet._id}/status`
              )
              const statusData = await statusRes.json()
              return statusData.data
            } catch {
              return { petId: pet._id, hasNFCTag: false, nfcTagId: null }
            }
          })
        )

        setNfcStatus(statuses)
      } else {
        setPets([])
        setNfcStatus([])
        toast('No pets found', {
          description: 'Try searching by pet or owner name',
        })
      }
    } catch (error) {
      console.error('Search error:', error)
      toast('Search failed', { description: 'Unable to search pets' })
    } finally {
      setSearching(false)
    }
  }

  // Start NFC writing process from pending request
  const handleStartWriteFromRequest = async (request: TagRequest) => {
    if (!readerAvailable) {
      toast('NFC reader not available', {
        description: 'Please connect an NFC reader and try again',
      })
      return
    }

    setWriteStage('waiting')
    setCurrentWrite({
      petId: request.petId._id,
      petName: request.petId.name,
      status: 'writing',
    })

    // Clear any existing timeout
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current)
    }

    // Set 60-second timeout
    writeTimeoutRef.current = setTimeout(() => {
      setCurrentWrite((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              error: 'Write timeout - no NFC tag detected. Please try again.',
            }
          : null
      )
    }, 60000)

    try {
      const response = await authenticatedFetch(
        `/nfc/pet/${request.petId._id}/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        token || ''
      )

      const data = response

      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current)
        writeTimeoutRef.current = null
      }

      if (data.status === 'SUCCESS') {
        setCurrentWrite({
          petId: request.petId._id,
          petName: request.petId.name,
          status: 'success',
          nfcTagId: data.data.nfcTagId,
          url: data.data.url,
        })

        // Mark request as fulfilled
        try {
          await authenticatedFetch(
            `/nfc/requests/${request._id}/fulfill`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
            },
            token || ''
          )
          // Refresh pending requests
          setPendingRequests(prev => prev.filter(r => r._id !== request._id))
        } catch (err) {
          console.error('Failed to mark request as fulfilled:', err)
        }

        toast('NFC tag written successfully!', {
          description: `Tag for ${request.petId.name} is ready`,
        })

        setSelectedRequest(null)
        setTimeout(() => {
          setCurrentWrite(null)
        }, 5000)
      } else {
        setCurrentWrite({
          petId: request.petId._id,
          petName: request.petId.name,
          status: 'error',
          error: data.message || 'Failed to write NFC tag',
        })
      }
    } catch {
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current)
        writeTimeoutRef.current = null
      }

      setCurrentWrite({
        petId: request.petId._id,
        petName: request.petId.name,
        status: 'error',
        error: 'An error occurred while writing the NFC tag',
      })
    }
  }

  // Start NFC writing process from search
  const handleStartWrite = async (pet: Pet) => {
    if (!readerAvailable) {
      toast('NFC reader not available', {
        description: 'Please connect an NFC reader and try again',
      })
      return
    }

    setWriteStage('waiting')
    setCurrentWrite({
      petId: pet._id,
      petName: pet.name,
      status: 'writing',
    })

    // Clear any existing timeout
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current)
    }

    // Set 60-second timeout
    writeTimeoutRef.current = setTimeout(() => {
      setCurrentWrite((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              error: 'Write timeout - no NFC tag detected. Please try again.',
            }
          : null
      )
    }, 60000)

    try {
      const response = await authenticatedFetch(
        `/nfc/pet/${pet._id}/write`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        token || ''
      )

      const data = response

      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current)
        writeTimeoutRef.current = null
      }

      if (data.status === 'SUCCESS') {
        setCurrentWrite({
          petId: pet._id,
          petName: pet.name,
          status: 'success',
          nfcTagId: data.data.nfcTagId,
          url: data.data.url,
        })

        // Update NFC status
        const updatedStatus = nfcStatus.map((s) =>
          s.petId === pet._id
            ? { ...s, hasNFCTag: true, nfcTagId: data.data.nfcTagId }
            : s
        )
        setNfcStatus(updatedStatus)

        toast('NFC tag written successfully!', {
          description: `Tag for ${pet.name} is ready`,
        })

        // Auto-close success message after 5 seconds
        setTimeout(() => {
          setCurrentWrite(null)
        }, 5000)
      } else {
        setCurrentWrite({
          petId: pet._id,
          petName: pet.name,
          status: 'error',
          error: data.message || 'Failed to write NFC tag',
        })
      }
    } catch {
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current)
        writeTimeoutRef.current = null
      }

      setCurrentWrite({
        petId: pet._id,
        petName: pet.name,
        status: 'error',
        error: 'An error occurred while writing the NFC tag',
      })
    }
  }

  const getPetNfcStatus = (petId: string) => {
    return nfcStatus.find((s) => s.petId === petId)
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-[#7FA5A3]/10 flex items-center justify-center">
              <Nfc className="w-6 h-6 text-[#7FA5A3]" />
            </div>
            <h1 className="text-3xl font-bold text-[#476B6B]">NFC Tag Management</h1>
          </div>
          <p className="text-gray-600">Write NFC tags for your clinic&apos;s patients</p>
        </div>

        {/* Reader Status */}
        <div className={`mb-8 p-4 rounded-xl border-2 flex items-center gap-3 ${
          readerAvailable
            ? 'bg-[#E8F5E9] border-[#4CAF50]'
            : 'bg-orange-50 border-orange-300'
        }`}>
          <Activity
            className={`w-5 h-5 ${
              readerAvailable ? 'text-[#4CAF50]' : 'text-orange-600'
            }`}
          />
          <div>
            <p className={`font-semibold ${
              readerAvailable ? 'text-[#2E7D32]' : 'text-orange-900'
            }`}>
              {readerAvailable ? 'NFC Reader Connected' : 'NFC Reader Not Available'}
            </p>
            <p className="text-sm text-gray-600">{readerStatus}</p>
          </div>
        </div>

        {/* Pending Tag Requests Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <Clock className="w-5 h-5 text-[#7FA5A3]" />
            <h2 className="text-xl font-bold text-[#476B6B]">Pending Tag Requests</h2>
            {pendingRequests.length > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                {pendingRequests.length}
              </span>
            )}
          </div>

          {loadingRequests ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-[#7FA5A3]" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 font-semibold mb-1">No Pending Requests</p>
              <p className="text-sm text-gray-400">
                Waiting for pet owners to request NFC tags...
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingRequests.map((request) => (
                <div
                  key={request._id}
                  className="bg-gradient-to-r from-blue-50 to-blue-25 rounded-lg border border-blue-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {request.petId.photo && (
                      <img
                        src={request.petId.photo}
                        alt={request.petId.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-[#476B6B]">
                          {request.petId.name}
                        </h3>
                        <span className="text-xs bg-blue-200 text-blue-700 px-2 py-1 rounded capitalize">
                          {request.petId.species}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        {request.petId.breed} • Owner: {request.ownerId.firstName} {request.ownerId.lastName}
                      </p>
                      {request.reason && (
                        <p className="text-xs text-gray-500 italic">
                          Reason: {request.reason.replace(/_/g, ' ')}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        Requested: {new Date(request.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedRequest(request)
                        handleStartWriteFromRequest(request)
                      }}
                      disabled={!readerAvailable}
                      className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${
                        readerAvailable
                          ? 'bg-[#7FA5A3] text-white hover:bg-[#6B8E8C]'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Nfc className="w-4 h-4" />
                      Write Tag
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search pet by name or owner name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7FA5A3] transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={!searchQuery.trim() || searching}
              className="px-6 py-3 bg-[#7FA5A3] text-white rounded-lg font-semibold hover:bg-[#6B8E8C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {searching ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search
                </>
              )}
            </button>
          </form>
        </div>

        {/* Writing Dialog */}
        {currentWrite && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full shadow-2xl p-8">
              {currentWrite.status === 'writing' && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center animate-pulse">
                      <Nfc className="w-8 h-8 text-[#7FA5A3]" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center text-[#476B6B] mb-2">
                    {writeStage === 'waiting' || writeStage === 'idle' ? 'Waiting for NFC Tag' :
                     writeStage === 'card-detected' ? 'Tag Detected!' :
                     writeStage === 'writing' ? 'Writing Data...' :
                     writeStage === 'verifying' ? 'Verifying Write...' :
                     'Writing NFC Tag'}
                  </h3>
                  <p className="text-center text-gray-600 mb-6">
                    {writeStage === 'waiting' || writeStage === 'idle' ? (
                      <>Place a blank NFC tag on your reader for <span className="font-semibold">{currentWrite.petName}</span></>
                    ) : writeStage === 'card-detected' ? (
                      'Tag detected, starting write...'
                    ) : writeStage === 'writing' ? (
                      'Writing NDEF data to tag pages...'
                    ) : writeStage === 'verifying' ? (
                      'Reading back data to verify write...'
                    ) : (
                      <>Place a blank NFC tag on your reader for <span className="font-semibold">{currentWrite.petName}</span></>
                    )}
                  </p>

                  {/* Progress Steps */}
                  <div className="space-y-2 mb-6">
                    {['waiting', 'card-detected', 'writing', 'verifying'].map((step, idx) => {
                      const stages = ['waiting', 'card-detected', 'writing', 'verifying']
                      const currentIdx = stages.indexOf(writeStage)
                      const isCompleted = idx < currentIdx
                      const isCurrent = idx === currentIdx
                      const labels = ['Waiting for tag...', 'Tag detected', 'Writing NDEF data', 'Verifying']

                      return (
                        <div key={step} className="flex items-center gap-3 text-sm">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted ? 'bg-[#4CAF50]' :
                            isCurrent ? 'bg-[#7FA5A3] animate-pulse' :
                            'bg-gray-200'
                          }`}>
                            {isCompleted ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : isCurrent ? (
                              <Loader className="w-3 h-3 text-white animate-spin" />
                            ) : null}
                          </div>
                          <span className={isCompleted || isCurrent ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                            {labels[idx]}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => {
                      if (writeTimeoutRef.current) clearTimeout(writeTimeoutRef.current)
                      setCurrentWrite(null)
                      setWriteStage('idle')
                    }}
                    className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}

              {currentWrite.status === 'success' && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-[#E8F5E9] flex items-center justify-center">
                      <Check className="w-8 h-8 text-[#4CAF50]" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center text-[#2E7D32] mb-2">
                    Tag Written Successfully!
                  </h3>
                  <p className="text-center text-gray-600 mb-4">
                    NFC tag for <span className="font-semibold">{currentWrite.petName}</span> has been written
                  </p>
                  {currentWrite.nfcTagId && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <p className="text-xs text-gray-500 mb-1">Tag ID</p>
                      <p className="text-sm font-mono text-gray-800 break-all">
                        {currentWrite.nfcTagId}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setCurrentWrite(null)}
                    className="w-full py-2 bg-[#4CAF50] text-white rounded-lg font-semibold hover:bg-[#45a049] transition-colors"
                  >
                    Done
                  </button>
                </>
              )}

              {currentWrite.status === 'error' && (
                <>
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-center text-red-600 mb-2">
                    Write Failed
                  </h3>
                  <p className="text-center text-gray-600 mb-4">
                    {currentWrite.error}
                  </p>
                  <button
                    onClick={() => setCurrentWrite(null)}
                    className="w-full py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pets List */}
        <div>
          {pets.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <PawPrint className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                {searchQuery ? 'No pets found' : 'Search for pets to get started'}
              </p>
              <p className="text-sm text-gray-500">
                {searchQuery
                  ? 'Try searching by a different name'
                  : 'Enter a pet or owner name to search'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pets.map((pet) => {
                const status = getPetNfcStatus(pet._id)
                const hasTag = status?.hasNFCTag

                return (
                  <div
                    key={pet._id}
                    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start gap-4">
                      {/* Pet Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-[#476B6B]">
                            {pet.name}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 capitalize">
                            {pet.species}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          {pet.breed} • Owner: {pet.owner.firstName} {pet.owner.lastName}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                            hasTag
                              ? 'bg-[#E8F5E9] text-[#2E7D32]'
                              : 'bg-orange-50 text-orange-700'
                          }`}>
                            <Nfc className="w-4 h-4" />
                            <span className="text-xs font-semibold">
                              {hasTag ? `Tag: ${status?.nfcTagId?.slice(-4)}` : 'No tag'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      {!hasTag && (
                        <button
                          onClick={() => handleStartWrite(pet)}
                          disabled={!readerAvailable}
                          className={`px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                            readerAvailable
                              ? 'bg-[#7FA5A3] text-white hover:bg-[#6B8E8C]'
                              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          <Nfc className="w-4 h-4" />
                          Write Tag
                        </button>
                      )}
                      {hasTag && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-[#E8F5E9] rounded-lg">
                          <Check className="w-5 h-5 text-[#4CAF50]" />
                          <span className="text-sm font-semibold text-[#2E7D32]">
                            Written
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
