'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  PawPrint,
  Calendar,
  FileText,
  Stethoscope,
  ClipboardList,
  Building2,
  MapPin,
  QrCode,
  ArrowRight,
  ScanLine,
  Shield,
  Heart,
  CheckCircle2,
  X,
  Smartphone,
  Camera,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import MouseEffectBackground from '@/components/kokonutui/mouse-effect-background'
import SmoothTab from '@/components/kokonutui/smooth-tab'

type RoleTab = 'pet-owners' | 'veterinarians' | 'clinics'

const roleContent: Record<
  RoleTab,
  {
    heading: string
    description: string
    features: string[]
    cards: { icon: React.ReactNode; title: string; description: string }[]
  }
> = {
  'pet-owners': {
    heading: 'Keep Your Furry Friends Safe & Healthy',
    description:
      'As a pet owner, you deserve peace of mind knowing your pet\'s health information is always accessible and secure',
    features: [
      'Digital vaccine cards accessible anywhere',
      'Complete medical history at your fingertips',
      'NFC/QR tags for instant pet identification',
      'Lost pet recovery with last scanned geolocation',
      'Easy appointment scheduling with your vet',
      'Billing history and invoice management',
    ],
    cards: [
      { icon: <PawPrint className="w-8 h-8 text-[#5A7C7A]" />, title: 'My Pets', description: 'Manage all your pets in one place' },
      { icon: <Shield className="w-8 h-8 text-[#5A7C7A]" />, title: 'Vaccine Card', description: 'Digital Vaccination Records' },
      { icon: <Calendar className="w-8 h-8 text-[#5A7C7A]" />, title: 'Appointments', description: 'Schedule & track vet visits' },
      { icon: <FileText className="w-8 h-8 text-[#5A7C7A]" />, title: 'Records', description: 'Complete Medical History' },
    ],
  },
  veterinarians: {
    heading: 'Focus on Care, Not Paperwork',
    description:
      'Streamline your practice with digital tools designed specifically for veterinary professionals',
    features: [
      'Digital Medical Records',
      'AI-Powered Notes Summarization',
      'Quick patient lookup via NFC/QR',
      'Appointment management and scheduling',
      'Appointment Verification through NFC/QR',
      'Invoice generation and billing tracking',
    ],
    cards: [
      { icon: <PawPrint className="w-8 h-8 text-[#5A7C7A]" />, title: 'My Patients', description: 'Manage all your pets in one place' },
      { icon: <Shield className="w-8 h-8 text-[#5A7C7A]" />, title: 'Electronic Medical Records', description: 'Digital Vaccination Records' },
      { icon: <Calendar className="w-8 h-8 text-[#5A7C7A]" />, title: 'Appointments', description: 'View Daily Schedule and Consults' },
      { icon: <ClipboardList className="w-8 h-8 text-[#5A7C7A]" />, title: 'AI-Powered', description: 'AI-Powered Notes Formatter' },
    ],
  },
  clinics: {
    heading: 'Manage Your Clinic with Ease',
    description:
      'Complete Clinic management solution with multi-branch support, appointment handling, and patient management',
    features: [
      'Multi-branch management',
      'Veterinarian PRC Verification',
      'Centralized patient records shared from other branches (on approval)',
      'Appointment Scheduling for all Veterinarians',
      'Appointment Verification through NFC/QR',
      'Comprehensive Billing and Invoicing',
    ],
    cards: [
      { icon: <Building2 className="w-8 h-8 text-[#5A7C7A]" />, title: 'Branches', description: 'Manage Multiple Locations' },
      { icon: <Shield className="w-8 h-8 text-[#5A7C7A]" />, title: 'Veterinarians', description: 'Veterinarian PRC Verification and Management' },
      { icon: <Calendar className="w-8 h-8 text-[#5A7C7A]" />, title: 'Appointments', description: 'Appointment Verification and Scheduling' },
      { icon: <FileText className="w-8 h-8 text-[#5A7C7A]" />, title: 'Record Sharing', description: 'Complete Medical History' },
    ],
  },
}

const powerFeatures = [
  {
    icon: <MapPin className="w-6 h-6 text-[#983232]" />,
    iconBg: 'bg-[#F5E0DE]',
    title: 'Lost Pet Recovery',
    description: 'Mark pets as lost and track last scanned location on map',
  },
  {
    icon: <FileText className="w-6 h-6 text-[#C4A44A]" />,
    iconBg: 'bg-[#F5EEDB]',
    title: 'Electronic Records',
    description: 'Complete Veterinary Medical records with AI-powered summaries',
  },
  {
    icon: <Shield className="w-6 h-6 text-[#4A9E6E]" />,
    iconBg: 'bg-[#DFF0E5]',
    title: 'Digital Vaccine Card',
    description: 'Access vaccination history anytime, anywhere. Never lose a paper record again',
  },
  {
    icon: <QrCode className="w-6 h-6 text-[#5A7AAD]" />,
    iconBg: 'bg-[#DEE5F0]',
    title: 'NFC & QR Tags',
    description: 'Instant pet identification with a simple tap or scan. No app required',
  },
]

const steps = [
  { number: 1, title: 'Create Your Account', description: 'Sign up as a pet owner, veterinarian or clinic administrator' },
  { number: 2, title: 'Set up your Profile', description: 'Add your pets, credentials or clinic information to get started' },
  { number: 3, title: 'Request for a Personalized tag', description: 'Pet owners are recommended to get an NFC/QR tag for their pets' },
  { number: 4, title: 'Start Managing', description: 'Access Records, Schedule Appointments, and connect with your pet care networks' },
]

const roleTabs = [
  { id: 'pet-owners', title: 'Pet Owners', icon: Heart, color: 'bg-[#5A7C7A]' },
  { id: 'veterinarians', title: 'Veterinarians', icon: Stethoscope, color: 'bg-[#5A7C7A]' },
  { id: 'clinics', title: 'Clinics', icon: Building2, color: 'bg-[#5A7C7A]' },
]

export default function Home() {
  const [activeTab, setActiveTab] = useState<RoleTab>('pet-owners')
  const [showScanModal, setShowScanModal] = useState(false)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'unsupported' | 'error'>('idle')
  const [qrStatus, setQrStatus] = useState<'idle' | 'scanning' | 'error'>('idle')
  const content = roleContent[activeTab]

  const nfcTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const qrScannerRef = useRef<Html5Qrcode | null>(null)
  const qrContainerRef = useRef<HTMLDivElement | null>(null)
  const nfcWsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    return () => {
      if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
      if (qrScannerRef.current) {
        qrScannerRef.current.stop().catch(() => {})
        qrScannerRef.current = null
      }
      if (nfcWsRef.current) {
        nfcWsRef.current.close()
        nfcWsRef.current = null
      }
    }
  }, [])

  const handleTapNfc = async () => {
    // Try browser Web NFC API first (mobile devices)
    if ('NDEFReader' in window) {
      try {
        setNfcStatus('scanning')
        const ndef = new (window as unknown as { NDEFReader: new () => { scan: () => Promise<void>; onreading: ((event: { serialNumber: string }) => void) | null } }).NDEFReader()
        await ndef.scan()

        nfcTimeoutRef.current = setTimeout(() => {
          setNfcStatus('error')
        }, 15000)

        ndef.onreading = (event) => {
          if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
          const tagId = event.serialNumber
          window.location.href = `/pet/${tagId}`
        }
        return
      } catch {
        setNfcStatus('error')
        return
      }
    }

    // Fall back to backend NFC reader via WebSocket (desktop with USB reader)
    try {
      setNfcStatus('scanning')
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'
      const backendHost = apiUrl.replace(/\/api$/, '')
      const wsUrl = backendHost.replace(/^http/, 'ws') + '/ws/nfc'
      const ws = new WebSocket(wsUrl)
      nfcWsRef.current = ws

      nfcTimeoutRef.current = setTimeout(() => {
        ws.close()
        nfcWsRef.current = null
        setNfcStatus('error')
      }, 15000)

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'card' && msg.data?.uid) {
          if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
          ws.close()
          nfcWsRef.current = null
          window.location.href = `/pet/${msg.data.uid}`
        }
      }

      ws.onerror = () => {
        if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
        nfcWsRef.current = null
        setNfcStatus('unsupported')
      }
    } catch {
      setNfcStatus('unsupported')
    }
  }

  const handleRetryNfc = () => {
    setNfcStatus('idle')
    handleTapNfc()
  }

  const stopQrScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop()
      } catch { /* ignore */ }
      qrScannerRef.current = null
    }
  }

  const handleScanQr = async () => {
    setNfcStatus('idle')
    setQrStatus('scanning')

    // Wait for the container div to render
    await new Promise((r) => setTimeout(r, 100))

    const container = document.getElementById('qr-reader')
    if (!container) {
      setQrStatus('error')
      return
    }

    try {
      const scanner = new Html5Qrcode('qr-reader')
      qrScannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // QR code detected — navigate to pet page
          stopQrScanner()
          setQrStatus('idle')
          window.location.href = decodedText.startsWith('http') ? decodedText : `/pet/${decodedText}`
        },
        () => {
          // QR scan frame — no match yet, do nothing
        },
      )
    } catch {
      setQrStatus('error')
    }
  }

  const handleCloseScanModal = () => {
    setShowScanModal(false)
    setNfcStatus('idle')
    setQrStatus('idle')
    stopQrScanner()
    if (nfcTimeoutRef.current) clearTimeout(nfcTimeoutRef.current)
  }

  return (
    <div className="min-h-screen bg-white relative">
      {/* ===== NAVBAR ===== */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-14 h-14 bg-[#476B6B] rounded-xl flex items-center justify-center">
            <Image
              src="/images/logos/pawsync-logo-white.png"
              alt="PawSync Logo"
              width={45}
              height={45}
            />
          </div>
          <span className="text-xl font-semibold text-[#476B6B]">PawSync</span>
        </Link>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowScanModal(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-[#4F4F4F] hover:bg-gray-50 transition-colors">
            <ScanLine className="w-4 h-4" />
            Scan Pet Tag
          </button>
          <Link
            href="/login"
            className="px-6 py-2 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors"
          >
            Sign In
          </Link>
        </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <MouseEffectBackground
        className="bg-[#F5FAF9] py-20"
        dotColor="#7FA5A3"
        dotSize={3}
        dotSpacing={20}
        repulsionRadius={100}
        repulsionStrength={25}
      >
        <div className="max-w-4xl mx-auto text-center px-4">
          <h1
            className="text-5xl md:text-6xl text-[#4F4F4F] mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Keep Your Pet&apos;s Health Records{' '}
            <span className="text-[#7FA5A3]">in One Place</span>
          </h1>
          <p className="text-gray-500 text-lg mb-10 max-w-2xl mx-auto">
            PawSync in the modern way to manage your pet&apos;s medical records. NFC & QR-enabled
            tags for instant access, anywhere.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 px-8 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] hover:scale-105 hover:shadow-lg transition-all duration-200 text-lg"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
            <button onClick={() => setShowScanModal(true)} className="flex items-center gap-2 px-8 py-3 bg-white border border-gray-300 rounded-lg text-[#4F4F4F] hover:bg-gray-50 hover:scale-105 hover:shadow-lg transition-all duration-200 text-lg">
              <ScanLine className="w-5 h-5" />
              Scan Pet Tag
            </button>
          </div>
        </div>
      </MouseEffectBackground>

      {/* ===== BUILT FOR EVERYONE ===== */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-[#4F4F4F] text-center mb-3"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Built for Everyone in Pet Care
          </h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            Weather you&apos;re a pet owner, veterinarian or clinic admin, PawSync has the tools you need.
          </p>

          {/* Role Tabs with Slider */}
          <div className="flex justify-center mb-12">
            <SmoothTab
              items={roleTabs}
              defaultTabId="pet-owners"
              showContent={false}
              activeColor="bg-[#5A7C7A]"
              onChange={(tabId) => setActiveTab(tabId as RoleTab)}
              className="inline-flex"
            />
          </div>

          {/* Role Content */}
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left - Description & Features */}
            <div>
              <h3 className="text-2xl font-semibold text-[#4F4F4F] mb-3">{content.heading}</h3>
              <p className="text-gray-500 mb-6">{content.description}</p>
              <ul className="space-y-3">
                {content.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#7FA5A3] shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right - Feature Cards Grid */}
            <div className="grid grid-cols-2 gap-4">
              {content.cards.map((card, i) => (
                <div
                  key={i}
                  className="bg-gray-50 rounded-xl p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow"
                >
                  <div className="mb-3">{card.icon}</div>
                  <h4 className="font-semibold text-[#4F4F4F] mb-1">{card.title}</h4>
                  <p className="text-gray-500 text-sm">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== POWER FEATURES ===== */}
      <section className="py-20 px-4 bg-[#F5FAF9]">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-[#4F4F4F] text-center mb-3"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Powerful Features for All
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            From digital vaccine cards to clinic management, PawSync has you covered
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {powerFeatures.map((feature, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 ${feature.iconBg} rounded-full flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h4 className="font-semibold text-[#4F4F4F] mb-2">{feature.title}</h4>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-[#4F4F4F] text-center mb-16 font-semibold"
          >
            How PawSync Works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#7FA5A3] flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {step.number}
                </div>
                <h4 className="font-semibold text-[#4F4F4F] mb-2">{step.title}</h4>
                <p className="text-gray-500 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER CTA ===== */}
      <section className="py-16 px-4 bg-[#5A7C7A]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-white/80 mb-8">
            Join PawSync today and keep your pet&apos;s health records safe, accessible, and always up to date.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3 bg-white text-[#5A7C7A] rounded-lg hover:bg-gray-100 transition-colors text-lg font-medium"
          >
            Create Your Account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* ===== SCAN PET TAG MODAL ===== */}
      {showScanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-[fadeIn_0.15s_ease-out]" onClick={handleCloseScanModal}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 relative animate-[scaleIn_0.15s_ease-out]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleCloseScanModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* ---- SCANNING STATE ---- */}
            {nfcStatus === 'scanning' && (
              <div className="flex flex-col items-center text-center py-4">
                <div className="relative w-28 h-28 mb-8">
                  {/* Pulse rings */}
                  <div className="absolute inset-0 rounded-full border-2 border-[#5A7C7A]/30 animate-[nfcPulse_2s_ease-out_infinite]" />
                  <div className="absolute inset-0 rounded-full border-2 border-[#5A7C7A]/20 animate-[nfcPulse_2s_ease-out_0.6s_infinite]" />
                  <div className="absolute inset-0 rounded-full border-2 border-[#5A7C7A]/10 animate-[nfcPulse_2s_ease-out_1.2s_infinite]" />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 bg-[#5A7C7A] rounded-full flex items-center justify-center animate-pulse">
                      <Smartphone className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </div>

                <h3 className="text-xl font-bold text-[#476B6B] mb-2">
                  Searching for NFC Tag...
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Hold the NFC tag close to your device&apos;s NFC reader
                </p>

                <div className="flex items-center gap-2 text-[#5A7C7A] text-sm font-medium">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#5A7C7A] rounded-full animate-[nfcDot_1.4s_ease-in-out_infinite]" />
                    <span className="w-2 h-2 bg-[#5A7C7A] rounded-full animate-[nfcDot_1.4s_ease-in-out_0.2s_infinite]" />
                    <span className="w-2 h-2 bg-[#5A7C7A] rounded-full animate-[nfcDot_1.4s_ease-in-out_0.4s_infinite]" />
                  </div>
                  Detecting NFC tag
                </div>

                <button
                  onClick={handleCloseScanModal}
                  className="mt-8 px-6 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ---- ERROR STATE ---- */}
            {nfcStatus === 'error' && (
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-20 h-20 bg-[#F5E0DE] rounded-full flex items-center justify-center mb-6 animate-[slowPulse_3s_ease-in-out_infinite]">
                  <Smartphone className="w-10 h-10 text-[#983232]" />
                </div>

                <h3 className="text-xl font-bold text-[#476B6B] mb-2">
                  No NFC Tag Detected
                </h3>
                <p className="text-gray-500 text-sm mb-2">
                  We couldn&apos;t find an NFC tag nearby. This could be because:
                </p>
                <ul className="text-gray-500 text-sm text-left mb-6 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    The tag wasn&apos;t close enough to the device
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    The NFC tag may be damaged or unresponsive
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    Your device&apos;s NFC reader may be obstructed
                  </li>
                </ul>

                <button
                  onClick={handleRetryNfc}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors font-medium mb-3"
                >
                  <Smartphone className="w-5 h-5" />
                  Try Again
                </button>
                <button
                  onClick={handleCloseScanModal}
                  className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ---- UNSUPPORTED STATE ---- */}
            {nfcStatus === 'unsupported' && qrStatus === 'idle' && (
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-20 h-20 bg-[#F5E0DE] rounded-full flex items-center justify-center mb-6 animate-[slowPulse_3s_ease-in-out_infinite]">
                  <Smartphone className="w-10 h-10 text-[#983232]" />
                </div>

                <h3 className="text-xl font-bold text-[#476B6B] mb-2">
                  NFC Not Supported
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Your device or browser does not support NFC scanning. Try using a QR code instead, or use a device with NFC capabilities.
                </p>

                <button
                  onClick={handleScanQr}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors mb-3"
                >
                  <QrCode className="w-5 h-5" />
                  Scan QR Code Instead
                </button>
                <button
                  onClick={handleCloseScanModal}
                  className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ---- QR SCANNING STATE ---- */}
            {qrStatus === 'scanning' && (
              <div className="flex flex-col items-center text-center py-4">
                <h3 className="text-xl font-bold text-[#476B6B] mb-2">
                  <Camera className="w-5 h-5 inline-block mr-2 -mt-0.5" />
                  Scan QR Code
                </h3>
                <p className="text-gray-500 text-sm mb-4">
                  Point your camera at the pet&apos;s QR code tag
                </p>

                <div
                  id="qr-reader"
                  ref={qrContainerRef}
                  className="w-full rounded-lg overflow-hidden mb-4"
                  style={{ minHeight: 280 }}
                />

                <button
                  onClick={handleCloseScanModal}
                  className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ---- QR ERROR STATE ---- */}
            {qrStatus === 'error' && (
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-20 h-20 bg-[#F5E0DE] rounded-full flex items-center justify-center mb-6 animate-[slowPulse_3s_ease-in-out_infinite]">
                  <Camera className="w-10 h-10 text-[#983232]" />
                </div>

                <h3 className="text-xl font-bold text-[#476B6B] mb-2">
                  Camera Access Failed
                </h3>
                <p className="text-gray-500 text-sm mb-2">
                  We couldn&apos;t access your camera. This could be because:
                </p>
                <ul className="text-gray-500 text-sm text-left mb-6 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    Camera permission was denied in your browser
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    Your device doesn&apos;t have a camera
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-gray-400 mt-0.5">•</span>
                    Another app is using the camera
                  </li>
                </ul>

                <button
                  onClick={handleScanQr}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors font-medium mb-3"
                >
                  <Camera className="w-5 h-5" />
                  Try Again
                </button>
                <button
                  onClick={handleCloseScanModal}
                  className="w-full px-6 py-3 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* ---- IDLE STATE (default) ---- */}
            {nfcStatus === 'idle' && qrStatus === 'idle' && (
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 animate-[slowPulse_3s_ease-in-out_infinite]">
                  <QrCode className="w-10 h-10 text-[#5A7C7A]" />
                </div>

                <h3 className="text-2xl text-[#476B6B] mb-2" style={{ fontFamily: 'var(--font-odor-mean-chey)' }}>
                  Scan Pet Tag
                </h3>
                <p className="text-gray-500 text-sm mb-8">
                  Access pet information instantly by scanning their NFC tag or QR code
                </p>

                <button
                  onClick={handleTapNfc}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors font-medium mb-4"
                >
                  <Smartphone className="w-5 h-5" />
                  Tap NFC Tag
                </button>

                <div className="flex items-center gap-4 w-full mb-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-gray-400 text-sm font-medium">OR</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <button
                  onClick={handleScanQr}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-gray-300 rounded-lg text-[#4F4F4F] hover:bg-gray-50 transition-colors font-medium mb-6"
                >
                  <QrCode className="w-5 h-5" />
                  Scan QR Code
                </button>

                <p className="text-gray-400 text-xs">
                  You&apos;ll see basic pet information and owner contact details if the owner has shared them
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
