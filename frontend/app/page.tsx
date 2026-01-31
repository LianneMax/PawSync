'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  PawPrint,
  Calendar,
  FileText,
  Stethoscope,
  ClipboardList,
  Clock,
  Users,
  Building2,
  Settings,
  MapPin,
  QrCode,
  ArrowRight,
  ScanLine,
  Shield,
  Heart,
  CheckCircle2,
} from 'lucide-react'

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
    heading: 'Streamline Your Veterinary Practice',
    description:
      'Access patient records instantly, manage appointments efficiently, and provide better care with digital tools',
    features: [
      'Instant access to complete patient histories',
      'Digital record creation with AI-powered summaries',
      'Appointment management and scheduling',
      'Direct communication with pet owners',
      'License verification and credentialing',
      'Seamless clinic collaboration',
    ],
    cards: [
      { icon: <Stethoscope className="w-8 h-8 text-[#5A7C7A]" />, title: 'Patients', description: 'View & manage patient records' },
      { icon: <ClipboardList className="w-8 h-8 text-[#5A7C7A]" />, title: 'Records', description: 'Create & edit medical records' },
      { icon: <Calendar className="w-8 h-8 text-[#5A7C7A]" />, title: 'Appointments', description: 'Manage your schedule' },
      { icon: <Clock className="w-8 h-8 text-[#5A7C7A]" />, title: 'Schedule', description: 'Set your availability' },
    ],
  },
  clinics: {
    heading: 'Manage Your Clinic Efficiently',
    description:
      'Oversee staff, manage appointments, and streamline operations with powerful admin tools',
    features: [
      'Staff management and role assignments',
      'Clinic-wide appointment overview',
      'Veterinarian verification management',
      'Clinic profile and settings control',
      'User and access management',
      'Analytics and reporting dashboard',
    ],
    cards: [
      { icon: <Building2 className="w-8 h-8 text-[#5A7C7A]" />, title: 'Dashboard', description: 'Clinic overview at a glance' },
      { icon: <Users className="w-8 h-8 text-[#5A7C7A]" />, title: 'Staff', description: 'Manage your team' },
      { icon: <Calendar className="w-8 h-8 text-[#5A7C7A]" />, title: 'Appointments', description: 'Clinic-wide scheduling' },
      { icon: <Settings className="w-8 h-8 text-[#5A7C7A]" />, title: 'Settings', description: 'Clinic configuration' },
    ],
  },
}

const powerFeatures = [
  {
    icon: <MapPin className="w-6 h-6 text-red-400" />,
    iconBg: 'bg-red-50',
    title: 'Lost Pet Recovery',
    description: 'Mark pets as lost and track last scanned location on map',
  },
  {
    icon: <FileText className="w-6 h-6 text-emerald-500" />,
    iconBg: 'bg-emerald-50',
    title: 'Electronic Records',
    description: 'Complete Veterinary Medical records with AI-powered summaries',
  },
  {
    icon: <Shield className="w-6 h-6 text-green-500" />,
    iconBg: 'bg-green-50',
    title: 'Digital Vaccine Card',
    description: 'Access vaccination history anytime, anywhere. Never lose a paper record again',
  },
  {
    icon: <QrCode className="w-6 h-6 text-blue-500" />,
    iconBg: 'bg-blue-50',
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<RoleTab>('pet-owners')
  const content = roleContent[activeTab]

  return (
    <div className="min-h-screen bg-white">
      {/* ===== NAVBAR ===== */}
      <nav className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logos/pawsync-logo.png"
            alt="PawSync Logo"
            width={40}
            height={40}
          />
          <span className="text-xl font-semibold text-gray-800">PawSync</span>
        </Link>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
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
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="bg-linear-to-b from-[#f0f5f5] to-white py-20">
        <div className="max-w-4xl mx-auto text-center px-4">
          <h1
            className="text-5xl md:text-6xl text-gray-800 mb-6 leading-tight"
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
              className="flex items-center gap-2 px-8 py-3 bg-[#5A7C7A] text-white rounded-lg hover:bg-[#4a6a68] transition-colors text-lg"
            >
              Get Started <ArrowRight className="w-5 h-5" />
            </Link>
            <button className="flex items-center gap-2 px-8 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-lg">
              <ScanLine className="w-5 h-5" />
              Scan Pet Tag
            </button>
          </div>
        </div>
      </section>

      {/* ===== BUILT FOR EVERYONE ===== */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-gray-800 text-center mb-3"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Built for Everyone in Pet Care
          </h2>
          <p className="text-gray-500 text-center mb-10 max-w-xl mx-auto">
            Weather you&apos;re a pet owner, veterinarian or clinic admin, PawSync has the tools you need.
          </p>

          {/* Role Tabs */}
          <div className="flex justify-center gap-3 mb-12">
            <button
              onClick={() => setActiveTab('pet-owners')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full transition-colors font-medium ${
                activeTab === 'pet-owners'
                  ? 'bg-[#5A7C7A] text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Heart className="w-5 h-5" />
              Pet Owners
            </button>
            <button
              onClick={() => setActiveTab('veterinarians')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full transition-colors font-medium ${
                activeTab === 'veterinarians'
                  ? 'bg-[#5A7C7A] text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Stethoscope className="w-5 h-5" />
              Veterinarians
            </button>
            <button
              onClick={() => setActiveTab('clinics')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full transition-colors font-medium ${
                activeTab === 'clinics'
                  ? 'bg-[#5A7C7A] text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-5 h-5" />
              Clinics
            </button>
          </div>

          {/* Role Content */}
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Left - Description & Features */}
            <div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">{content.heading}</h3>
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
                  <h4 className="font-semibold text-gray-800 mb-1">{card.title}</h4>
                  <p className="text-gray-500 text-sm">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== POWER FEATURES ===== */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-gray-800 text-center mb-3 italic"
            style={{ fontFamily: 'var(--font-odor-mean-chey)' }}
          >
            Power Features for All
          </h2>
          <p className="text-gray-500 text-center mb-12 max-w-xl mx-auto">
            From digital vaccine cards to clinic management, PawSync has you covered
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {powerFeatures.map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                  {feature.icon}
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">{feature.title}</h4>
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
            className="text-3xl md:text-4xl text-gray-800 text-center mb-16 font-semibold"
          >
            How PawSync Works
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-[#7FA5A3] flex items-center justify-center text-white text-2xl font-bold mb-4">
                  {step.number}
                </div>
                <h4 className="font-semibold text-gray-800 mb-2">{step.title}</h4>
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
    </div>
  )
}
