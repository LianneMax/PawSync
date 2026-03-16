'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import Image from 'next/image'
import DashboardLayout from '@/components/DashboardLayout'
import { getClinicPatients, type ClinicPatient } from '@/lib/clinics'
import { getRecordsByPet, getVaccinationsByPet, type MedicalRecord, type Vaccination } from '@/lib/medicalRecords'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Smartphone, Search, FileText, Calendar, PawPrint,
  ChevronRight, Info, Clock, User, Syringe, Stethoscope,
  Pill, FolderOpen, Printer, Share2, Edit, Upload, X, CheckCircle, AlertCircle,
  QrCode, Loader, Receipt
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Html5Qrcode } from 'html5-qrcode'

// ==================== TYPES ====================

type PatientTab = 'overview' | 'vaccine' | 'medical' | 'medications' | 'files'
type ScanMode = 'nfc' | 'qr' | null
type ScanStatus = 'idle' | 'scanning' | 'success' | 'error'

// ==================== HELPERS ====================

function calculateAge(dateOfBirth: string): string {
  const birth = new Date(dateOfBirth)
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (totalMonths < 1) return 'Newborn'
  if (totalMonths < 12) return `${totalMonths} month${totalMonths > 1 ? 's' : ''}`
  const y = Math.floor(totalMonths / 12)
  return `${y} year${y > 1 ? 's' : ''}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ==================== TAB: OVERVIEW ====================

function OverviewTab({ patient, records, loadingRecords }: {
  patient: ClinicPatient
  records: MedicalRecord[]
  loadingRecords: boolean
}) {
  const latestRecord = records[0] || null

  return (
    <div className="space-y-6">
      {/* Pet Information */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Pet Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Species</p>
            <p className="text-sm font-medium text-[#4F4F4F] capitalize">{patient.species}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Breed</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{patient.breed || '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Sex</p>
            <p className="text-sm font-medium text-[#4F4F4F] capitalize">{patient.sex}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Age</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{calculateAge(patient.dateOfBirth)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Date of Birth</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{formatDate(patient.dateOfBirth)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">Weight</p>
            <p className="text-sm font-medium text-[#4F4F4F]">{patient.weight ? `${patient.weight} kg` : '—'}</p>
          </div>
          {patient.microchipNumber && (
            <div className="bg-gray-50 rounded-lg p-3 col-span-2">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Microchip #</p>
              <p className="text-sm font-medium text-[#4F4F4F] font-mono">{patient.microchipNumber}</p>
            </div>
          )}
          {patient.bloodType && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">Blood Type</p>
              <p className="text-sm font-medium text-[#4F4F4F]">{patient.bloodType}</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Vitals */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">
            Latest Vitals
            {latestRecord && (
              <span className="ml-2 text-xs font-normal text-gray-400 normal-case">
                [{formatDateTime(latestRecord.createdAt)}]
              </span>
            )}
          </h3>
        </div>
        {loadingRecords ? (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#7FA5A3]" />
          </div>
        ) : latestRecord ? (
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(latestRecord.vitals) as [string, { value: string | number; notes: string }][]).map(([key, vital]) => (
              <div key={key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-sm font-semibold text-[#4F4F4F]">
                  {vital.value !== undefined && vital.value !== '' ? vital.value : '—'}
                </p>
                {vital.notes && <p className="text-xs text-gray-400 mt-0.5">{vital.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
            No vitals recorded yet
          </div>
        )}
      </section>

      {/* Owner Details */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-[#4A8A87]" />
          <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Owner Details</h3>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7FA5A3]/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-[#4A8A87]">
                {patient.owner.firstName[0]}{patient.owner.lastName[0]}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#4F4F4F]">
                {patient.owner.firstName} {patient.owner.lastName}
              </p>
              <p className="text-xs text-gray-500">{patient.owner.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1 border-t border-gray-200">
            <div>
              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Contact</p>
              <p className="text-sm text-[#4F4F4F]">{patient.owner.contactNumber || '—'}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ==================== TAB: VACCINE CARD ====================

function VaccineCardTab({ petId, token }: { petId: string; token: string | null }) {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    getVaccinationsByPet(petId, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.vaccinations) {
          setVaccinations(res.data.vaccinations)
        }
      })
      .catch(() => toast.error('Failed to load vaccinations'))
      .finally(() => setLoading(false))
  }, [petId, token])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7FA5A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Syringe className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Vaccination Records</h3>
      </div>
      {vaccinations.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No vaccinations recorded</p>
          <p className="text-xs text-gray-400 mt-1">Vaccination records will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vaccinations.map((vax) => {
            const isOverdue = vax.nextDueDate && new Date(vax.nextDueDate) < new Date()
            return (
              <div key={vax._id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {vax.isUpToDate && !isOverdue ? (
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <h4 className="text-sm font-semibold text-[#4F4F4F]">{vax.vaccineName}</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Administered</p>
                        <p className="text-xs text-[#4F4F4F]">{formatDate(vax.dateAdministered)}</p>
                      </div>
                      {vax.nextDueDate && (
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">Next Due</p>
                          <p className={`text-xs font-medium ${isOverdue ? 'text-amber-600' : 'text-[#4F4F4F]'}`}>
                            {formatDate(vax.nextDueDate)}
                            {isOverdue && ' (Overdue)'}
                          </p>
                        </div>
                      )}
                    </div>
                    {vax.vetId && (
                      <p className="text-xs text-gray-400 mt-2">
                        By Dr. {vax.vetId.firstName} {vax.vetId.lastName}
                        {vax.clinicId?.name && ` — ${vax.clinicId.name}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== TAB: MEDICAL RECORD ====================

function MedicalRecordTab({ records, loading }: { records: MedicalRecord[]; loading: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#7FA5A3]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Medical Records</h3>
      </div>
      {records.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No medical records</p>
          <p className="text-xs text-gray-400 mt-1">Visit records will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => {
            const isExpanded = expandedId === record._id
            return (
              <div key={record._id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Visit Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : record._id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Stethoscope className="w-4 h-4 text-[#7FA5A3] flex-shrink-0" />
                        <span className="text-sm font-semibold text-[#4F4F4F]">
                          Visit — {formatDateTime(record.createdAt)}
                        </span>
                      </div>
                      {record.vetId && (
                        <p className="text-xs text-gray-500 ml-6">
                          Dr. {record.vetId.firstName} {record.vetId.lastName}
                          {record.clinicId?.name && ` · ${record.clinicId.name}`}
                        </p>
                      )}
                      {record.visitSummary && (
                        <p className="text-xs text-gray-600 mt-2 ml-6 line-clamp-2 bg-blue-50 rounded px-2 py-1">
                          {record.visitSummary}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 space-y-4 pt-4">
                    {/* Visit Summary (full) */}
                    {record.visitSummary && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Visit Summary</p>
                        <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3 whitespace-pre-wrap">
                          {record.visitSummary}
                        </p>
                      </div>
                    )}

                    {/* Vet Notes (clinic admin can see) */}
                    {record.vetNotes && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 uppercase mb-1 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                          Vet Notes (Private)
                        </p>
                        <p className="text-sm text-gray-700 bg-amber-50 border border-amber-100 rounded-lg p-3 whitespace-pre-wrap">
                          {record.vetNotes}
                        </p>
                      </div>
                    )}

                    {/* Vitals Grid */}
                    {record.vitals && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Vitals</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(Object.entries(record.vitals) as [string, { value: string | number; notes: string }][]).map(([key, vital]) => (
                            <div key={key} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                              <p className="text-xs text-gray-400 uppercase font-medium mb-0.5">
                                {key.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              <p className="text-xs font-semibold text-[#4F4F4F]">
                                {vital.value !== undefined && vital.value !== '' ? vital.value : '—'}
                              </p>
                              {vital.notes && (
                                <p className="text-xs text-gray-400 mt-0.5">{vital.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical Assessment */}
                    {record.overallObservation && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Clinical Assessment</p>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                          {record.overallObservation}
                        </p>
                      </div>
                    )}

                    {/* View Billing */}
                    {record.billingId && (
                      <div className="pt-2 border-t border-gray-100">
                        <Link
                          href={`/clinic-admin/medical-records/${record._id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5A7C7A] hover:bg-[#476B6B] text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          View Bill
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ==================== TAB: MEDICATIONS ====================

function MedicationsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Pill className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Medications</h3>
      </div>
      <div className="bg-gray-50 rounded-xl p-8 text-center">
        <Pill className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-500">No medications recorded</p>
        <p className="text-xs text-gray-400 mt-1">Medication records will appear here</p>
      </div>
    </div>
  )
}

// ==================== TAB: FILES & IMAGES ====================

function FilesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen className="w-4 h-4 text-[#4A8A87]" />
        <h3 className="text-sm font-semibold text-[#4A8A87] uppercase tracking-wide">Files & Images</h3>
      </div>
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center bg-gray-50">
        <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/10 flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6 text-[#7FA5A3]" />
        </div>
        <p className="text-sm font-medium text-gray-600 mb-1">
          Drag & drop files or{' '}
          <span className="text-[#4A8A87] underline cursor-pointer">Browse</span>
        </p>
        <p className="text-xs text-gray-400">Supported formats: JPEG, PNG, GIF, MP4, PDF, PSD, AI, Word, PPT</p>
      </div>
      <button className="w-full py-3 bg-[#4A8A87] hover:bg-[#3d7370] text-white text-sm font-semibold rounded-xl transition-colors uppercase tracking-wide">
        Upload Files
      </button>
    </div>
  )
}

// ==================== SCAN MODAL ====================

interface ScanModalProps {
  open: boolean
  onClose: () => void
  scanMode: ScanMode
  scanStatus: ScanStatus
  onScanComplete: (petId: string) => void
}

function ScanModal({ open, onClose, scanMode, scanStatus, onScanComplete }: ScanModalProps) {
  const qrContainerRef = useRef<HTMLDivElement | null>(null)
  const qrScannerRef = useRef<Html5Qrcode | null>(null)
  const nfcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const nfcWsRef = useRef<WebSocket | null>(null)
  const [scanError, setScanError] = useState<string>('')
  const [isLookingUpPet, setIsLookingUpPet] = useState(false)

  // Cleanup function for QR scanner
  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop()
      } catch {
        /* ignore */
      }
      qrScannerRef.current = null
    }
  }

  // Cleanup function for NFC
  const stopNfcScanning = () => {
    if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
    if (nfcWsRef.current) {
      nfcWsRef.current.close()
      nfcWsRef.current = null
    }
  }

  // Look up pet by NFC tag ID via API
  const lookupPetByNfcId = useCallback(async (nfcTagId: string) => {
    setIsLookingUpPet(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const response = await fetch(`${apiUrl}/nfc/by-tag-id/${encodeURIComponent(nfcTagId)}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.status === 'SUCCESS' && data.data?.pet?._id) {
          onScanComplete(data.data.pet._id)
          return
        }
      }
      
      setScanError('Pet not found. This NFC tag may not be registered in the system.')
    } catch (error) {
      console.error('Error looking up pet by NFC tag:', error)
      setScanError('Failed to look up pet. Please try again.')
    } finally {
      setIsLookingUpPet(false)
    }
  }, [onScanComplete])

  // Handle NFC scanning
  const startNfcScan = useCallback(() => {
    setScanError('')
    stopNfcScanning()

    // Try browser Web NFC API first (mobile devices)
    if ('NDEFReader' in window) {
      try {
        const ndef = new (window as unknown as {
          NDEFReader: new () => {
            scan: () => Promise<void>
            onreading: ((event: { serialNumber: string }) => void) | null
          }
        }).NDEFReader()

        ndef.scan().catch(() => {
          // User cancelled, try backend NFC
          startBackendNfcScan()
        })

        nfcTimeoutRef.current = setTimeout(() => {
          setScanError('No NFC tag detected. Please try again.')
        }, 15000)

        ndef.onreading = (event) => {
          if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
          const tagId = event.serialNumber
          // Look up pet by NFC tag ID via API
          lookupPetByNfcId(tagId)
        }
      } catch {
        startBackendNfcScan()
      }
    } else {
      startBackendNfcScan()
    }
  }, [lookupPetByNfcId])

  // Start backend NFC scan via WebSocket
  const startBackendNfcScan = () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const backendHost = apiUrl.replace(/\/api$/, '')
      const wsUrl = backendHost.replace(/^http/, 'ws') + '/ws/nfc'
      const ws = new WebSocket(wsUrl)
      nfcWsRef.current = ws

      nfcTimeoutRef.current = setTimeout(() => {
        ws.close()
        nfcWsRef.current = null
        setScanError('No NFC tag detected. Please try again.')
      }, 15000)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'card' && msg.data?.uid) {
            if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
            ws.close()
            nfcWsRef.current = null
            
            // Look up pet by NFC tag UID via API
            lookupPetByNfcId(msg.data.uid)
          }
        } catch {
          // ignore parse errors
        }
      }

      ws.onerror = () => {
        if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
        nfcWsRef.current = null
        setScanError('NFC reader not available. Please try QR code instead.')
      }
    } catch {
      setScanError('NFC scanning not supported on this device.')
    }
  }

  // Handle QR code scanning
  const startQrScan = useCallback(async () => {
    setScanError('')
    const container = document.getElementById('clinic-qr-reader')
    if (!container) {
      setScanError('QR reader not available')
      return
    }

    try {
      const scanner = new Html5Qrcode('clinic-qr-reader')
      qrScannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // QR code detected
          stopQrScanner()
          const petId = decodedText.includes('/') ? decodedText.split('/').pop() : decodedText
          if (petId) {
            onScanComplete(petId)
          } else {
            setScanError('Invalid QR code format.')
          }
        },
        () => {
          // No match yet, do nothing
        },
      )
    } catch {
      setScanError('QR code reader not supported on this device.')
    }
  }, [onScanComplete])

  // Start scanning when modal opens
  useEffect(() => {
    if (open && scanMode === 'nfc' && scanStatus === 'scanning') {
      startNfcScan()
    }
    if (open && scanMode === 'qr' && scanStatus === 'scanning') {
      startQrScan()
    }

    return () => {
      stopQrScanner()
      stopNfcScanning()
    }
  }, [open, scanMode, scanStatus, startNfcScan, startQrScan])

  const handleClose = () => {
    stopQrScanner()
    stopNfcScanning()
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-[#4F4F4F]">
            {scanMode === 'nfc' ? 'Scan Pet Tag (NFC)' : 'Scan QR Code'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Idle State */}
        {scanStatus === 'idle' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {scanMode === 'nfc' ? (
                <Smartphone className="w-8 h-8 text-[#4A8A87]" />
              ) : (
                <QrCode className="w-8 h-8 text-[#4A8A87]" />
              )}
            </div>
            <p className="text-gray-600 text-sm mb-6">
              {scanMode === 'nfc'
                ? 'Tap the pet tag on the NFC reader.'
                : 'Align the QR code within the camera frame.'}
            </p>
          </div>
        )}

        {/* Scanning State */}
        {(scanStatus === 'scanning' || isLookingUpPet) && (
          <div className="text-center">
            {scanMode === 'qr' && !isLookingUpPet && (
              <div
                id="clinic-qr-reader"
                className="mb-4 rounded-lg overflow-hidden"
                style={{ width: '100%', height: '250px' }}
              />
            )}
            {(scanMode === 'nfc' || isLookingUpPet) && (
              <div className="mb-4">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full border-2 border-[#4A8A87]/30 animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-2 border-[#4A8A87]/20 animate-pulse" style={{ animationDelay: '0.6s' }} />
                  <Smartphone className="w-12 h-12 text-[#4A8A87] mx-auto mt-6" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-gray-600 text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              {isLookingUpPet ? 'Looking up pet...' : 'Scanning...'}
            </div>
          </div>
        )}

        {/* Error State */}
        {scanStatus === 'error' && scanError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 text-sm">Scan Failed</h3>
                <p className="text-red-700 text-xs mt-1">{scanError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {scanStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              <p className="text-green-700 text-sm font-medium">Pet found! Opening profile...</p>
            </div>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex gap-3">
          {(scanStatus === 'scanning' || isLookingUpPet) && (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          )}
          {(scanStatus === 'error' || scanStatus === 'idle') && (
            <>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              {scanStatus === 'error' && (
                <button
                  onClick={() => {
                    setScanError('')
                    setIsLookingUpPet(false)
                    if (scanMode === 'nfc') startNfcScan()
                    else startQrScan()
                  }}
                  className="flex-1 px-4 py-2 bg-[#4A8A87] hover:bg-[#3d7370] text-white rounded-lg font-medium text-sm transition-colors"
                >
                  Retry
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==================== PATIENT DRAWER ====================

const DRAWER_MIN_WIDTH = 380
const DRAWER_MAX_WIDTH = 860

function PatientDrawer({
  patient,
  open,
  onClose,
  token,
}: {
  patient: ClinicPatient | null
  open: boolean
  onClose: () => void
  token: string | null
}) {
  const [activeTab, setActiveTab] = useState<PatientTab>('overview')
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(520)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(0)

  // Reset tab and load records when patient changes
  useEffect(() => {
    if (!patient || !token) return
    setActiveTab('overview')
    setLoadingRecords(true)
    getRecordsByPet(patient._id, token)
      .then((res) => {
        if (res.status === 'SUCCESS' && res.data?.records) {
          setRecords(res.data.records)
        } else {
          setRecords([])
        }
      })
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?._id, token])
  // Note: 'patient' object reference is intentionally excluded; only the id matters

  // Resize drag logic
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartWidth.current = drawerWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = dragStartX.current - e.clientX
      const next = Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, dragStartWidth.current + delta))
      setDrawerWidth(next)
    }
    const onMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const tabs: { id: PatientTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'vaccine', label: 'Vaccine Card' },
    { id: 'medical', label: 'Medical Record' },
    { id: 'medications', label: 'Medications' },
    { id: 'files', label: 'Files & Images' },
  ]

  if (!patient) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="!p-0 flex flex-col !max-w-none"
        style={{ width: `${drawerWidth}px`, maxWidth: 'none', transition: 'none' }}
        close={false}
      >
        {/* Resize handle — drag from left edge to resize */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute left-0 top-0 bottom-0 w-5 z-20 cursor-col-resize group select-none"
          title="Drag to resize"
        >
          {/* Left border line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 group-hover:bg-[#4A8A87] transition-colors duration-150" />
          {/* Grip pill */}
          <div
            className="absolute left-[3px] flex flex-col gap-[3px] items-center bg-white border border-gray-200 group-hover:border-[#4A8A87] rounded-full px-[3px] py-2 shadow-sm opacity-50 group-hover:opacity-100 transition-all duration-150"
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="block w-[3px] h-[3px] rounded-full bg-gray-400 group-hover:bg-[#4A8A87] transition-colors duration-150"
              />
            ))}
          </div>
        </div>
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              {patient.photo ? (
                <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-[#7FA5A3]/30">
                  <Image
                    src={patient.photo}
                    alt={patient.name}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-[#7FA5A3]/15 flex items-center justify-center flex-shrink-0">
                  <PawPrint className="w-6 h-6 text-[#4A8A87]" />
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-[#4F4F4F] leading-tight">
                  Patient Profile — {patient.name}
                </h2>
                <p className="text-xs text-gray-500 capitalize mt-0.5">
                  {patient.species} · {patient.breed}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pb-0">
            <div className="flex gap-1 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-[#4A8A87] text-[#4A8A87] bg-[#4A8A87]/5'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {activeTab === 'overview' && (
            <OverviewTab patient={patient} records={records} loadingRecords={loadingRecords} />
          )}
          {activeTab === 'vaccine' && (
            <VaccineCardTab petId={patient._id} token={token} />
          )}
          {activeTab === 'medical' && (
            <MedicalRecordTab records={records} loading={loadingRecords} />
          )}
          {activeTab === 'medications' && <MedicationsTab />}
          {activeTab === 'files' && <FilesTab />}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-2">
              <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Printer className="w-3.5 h-3.5" />
                Print
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-[#4A8A87] hover:bg-[#3d7370] text-white rounded-lg text-xs font-semibold transition-colors">
              <Edit className="w-3.5 h-3.5" />
              Edit Patient
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ==================== MAIN PAGE ====================

export default function PatientManagementPage() {
  const token = useAuthStore((state) => state.token)

  const [patients, setPatients] = useState<ClinicPatient[]>([])
  const [filteredPatients, setFilteredPatients] = useState<ClinicPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [speciesFilter, setSpeciesFilter] = useState<'all' | 'canine' | 'feline'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<ClinicPatient | null>(null)

  // Scan states
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [scanMode, setScanMode] = useState<ScanMode>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanningPetId, setScanningPetId] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string>('')

  // Fetch patients — backend derives clinic/branch from the JWT directly
  const fetchPatients = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await getClinicPatients(token)
      if (response.status === 'SUCCESS' && response.data?.patients) {
        setPatients(response.data.patients)
        setFilteredPatients(response.data.patients)
      } else {
        setPatients([])
        setFilteredPatients([])
      }
    } catch (error) {
      console.error('Failed to fetch patients:', error)
      toast.error('Failed to fetch patients')
      setPatients([])
      setFilteredPatients([])
    } finally {
      setLoading(false)
    }
  }, [token])

  const applyFilters = (data: ClinicPatient[], species: string, query: string) => {
    let filtered = data
    if (species !== 'all') {
      filtered = filtered.filter((p) => p.species === species)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.owner.firstName.toLowerCase().includes(q) ||
          p.owner.lastName.toLowerCase().includes(q) ||
          p.owner.contactNumber.includes(q) ||
          p.microchipNumber?.includes(q)
      )
    }
    setFilteredPatients(filtered)
  }

  const handleSpeciesChange = (species: 'all' | 'canine' | 'feline') => {
    setSpeciesFilter(species)
    applyFilters(patients, species, searchQuery)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    applyFilters(patients, speciesFilter, query)
  }

  // Handle NFC scan completion
  const handleNfcScanComplete = (petId: string) => {
    const pet = patients.find(p => p._id === petId || p.microchipNumber === petId)
    if (pet) {
      setSelectedPatient(pet)
      setScanModalOpen(false)
      setScanMode(null)
      setScanStatus('idle')
      toast.success(`Found ${pet.name}!`)
    } else {
      setScanStatus('error')
      toast.error('Pet not found. Please check the tag and try again.')
    }
  }

  // Handle QR scan completion
  const handleQrScanComplete = (petId: string) => {
    const pet = patients.find(p => p._id === petId || p.microchipNumber === petId)
    if (pet) {
      setSelectedPatient(pet)
      setScanModalOpen(false)
      setScanMode(null)
      setScanStatus('idle')
      toast.success(`Found ${pet.name}!`)
    } else {
      setScanStatus('error')
      toast.error('Pet not found. Please check the QR code and try again.')
    }
  }

  // Open scan modal
  const handleStartScan = (mode: ScanMode) => {
    setScanMode(mode)
    setScanStatus('scanning')
    setScanModalOpen(true)
  }

  useEffect(() => { fetchPatients() }, [fetchPatients])
  useEffect(() => { applyFilters(patients, speciesFilter, searchQuery) }, [patients, speciesFilter, searchQuery])

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 max-w-7xl w-full h-screen flex flex-col">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#4F4F4F] mb-2">Patient Management</h1>
          <p className="text-gray-500">Stay on top of your patients&apos; care</p>
        </div>

        {/* Species Filter Pill */}
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-sm font-semibold text-[#2D5353]">Select Species:</span>
          <div className="inline-flex bg-white rounded-full p-1.5 shadow-sm">
            {(['all', 'canine', 'feline'] as const).map((species) => (
              <button
                key={species}
                onClick={() => handleSpeciesChange(species)}
                className={`px-12 py-2.5 rounded-full text-sm font-medium transition-all ${
                  speciesFilter === species
                    ? 'bg-[#476B6B] text-white shadow-sm'
                    : 'text-[#4F4F4F] hover:bg-gray-50'
                }`}
              >
                {species === 'all' ? 'All' : species === 'canine' ? 'Dogs' : 'Cats'}
              </button>
            ))}
          </div>
        </div>

        {/* Scan Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => handleStartScan('nfc')}
            className="bg-white rounded-lg border border-dashed border-[#476B6B] px-6 py-4 flex items-center gap-4 cursor-pointer hover:border-[#2D5353] hover:bg-gray-50 transition-all"
          >
            <PawPrint className="w-8 h-8 text-[#476B6B] flex-shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-[#476B6B]">Scan NFC Tag</p>
              <p className="text-xs text-[#2D5353] mt-0.5">Tap the NFC tag or Scan the QR Code of the Patient to see their record</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#476B6B] flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
          </button>
          <button
            onClick={() => handleStartScan('qr')}
            className="bg-white rounded-lg border border-dashed border-[#476B6B] px-6 py-4 flex items-center gap-4 cursor-pointer hover:border-[#2D5353] hover:bg-gray-50 transition-all"
          >
            <PawPrint className="w-8 h-8 text-[#476B6B] flex-shrink-0" />
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-[#476B6B]">Scan QR Code</p>
              <p className="text-xs text-[#2D5353] mt-0.5">Tap the NFC tag or Scan the QR Code of the Patient to see their record</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#476B6B] flex items-center justify-center flex-shrink-0">
              <QrCode className="w-5 h-5 text-white" />
            </div>
          </button>
        </div>

        {/* Patients List */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col shadow-md flex-1">
          {/* Search & Actions Container */}
          <div className="bg-white px-6 py-5 border-b border-[#EAECF0] shadow-sm flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Enter a Client Name, Patients Name or ID Tag"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7FA5A3]"
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap">
                <FileText className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#7FA5A3]" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500 mb-2">No patients found</h3>
                <p className="text-gray-400 text-center">
                  {patients.length === 0
                    ? 'No medical records have been created yet'
                    : 'Try adjusting your filters or search query'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient._id}
                    onClick={() => setSelectedPatient(patient)}
                    className={`w-full hover:bg-gray-50 p-6 transition-colors text-left ${
                      selectedPatient?._id === patient._id ? 'bg-[#7FA5A3]/5 border-l-2 border-[#4A8A87]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex gap-4 flex-1">
                        {patient.photo ? (
                          <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                            <Image
                              src={patient.photo}
                              alt={patient.name}
                              width={64}
                              height={64}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                            <PawPrint className="w-8 h-8 text-gray-400" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[#4F4F4F] mb-1">{patient.name}</h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {patient.breed} · {patient.species === 'canine' ? 'Dog' : 'Cat'} · {patient.sex === 'male' ? 'Male' : 'Female'}
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <p className="text-gray-400 uppercase font-semibold mb-1">Owner</p>
                              <p className="text-gray-700 font-medium">
                                {patient.owner.firstName} {patient.owner.lastName}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase font-semibold mb-1">Contact</p>
                              <p className="text-gray-700 font-medium">{patient.owner.contactNumber}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase font-semibold mb-1">Blood Type</p>
                              <p className="text-gray-700 font-medium">{patient.bloodType || '—'}</p>
                            </div>
                            <div>
                              <p className="text-gray-400 uppercase font-semibold mb-1">Records</p>
                              <p className="text-gray-700 font-medium">{patient.recordCount}</p>
                            </div>
                          </div>
                          {patient.lastVisit && (
                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-3">
                              <Calendar className="w-3 h-3" />
                              <span>
                                Last visit:{' '}
                                {new Date(patient.lastVisit).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-2" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Slide-Out Drawer */}
      <PatientDrawer
        patient={selectedPatient}
        open={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        token={token}
      />

      {/* Scan Modal */}
      <ScanModal
        open={scanModalOpen}
        onClose={() => {
          setScanModalOpen(false)
          setScanMode(null)
          setScanStatus('idle')
        }}
        scanMode={scanMode}
        scanStatus={scanStatus}
        onScanComplete={scanMode === 'nfc' ? handleNfcScanComplete : handleQrScanComplete}
      />
    </DashboardLayout>
  )
}
