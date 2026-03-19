'use client'

import { useEffect, useState } from 'react'
import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

type AcceptState = 'loading' | 'success' | 'error'

function AcceptInvitationContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [state, setState] = useState<AcceptState>('loading')
  const [branchName, setBranchName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setErrorMessage('No invitation token provided.')
      setState('error')
      return
    }

    const acceptInvitation = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/clinics/invite/accept?token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (data.status === 'SUCCESS') {
          setBranchName(data.data?.branchName || '')
          setClinicName(data.data?.clinicName || '')
          setState('success')
        } else {
          setErrorMessage(data.message || 'Failed to accept invitation.')
          setState('error')
        }
      } catch {
        setErrorMessage('An unexpected error occurred. Please try again.')
        setState('error')
      }
    }

    acceptInvitation()
  }, [token])

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F6F2' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        {/* PawSync branding */}
        <p style={{ color: '#5A7C7A', fontWeight: 700, fontSize: 18, marginBottom: 32, letterSpacing: 0.5 }}>PawSync</p>

        {state === 'loading' && (
          <>
            <Loader2 style={{ width: 48, height: 48, color: '#5A7C7A', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#4F4F4F', marginBottom: 8 }}>Processing Invitation</h1>
            <p style={{ color: '#9CA3AF', fontSize: 14 }}>Please wait while we confirm your invitation...</p>
            <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle style={{ width: 56, height: 56, color: '#5A7C7A', margin: '0 auto 16px' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F4F4F', marginBottom: 12 }}>Welcome Aboard!</h1>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
              You have successfully joined{' '}
              <strong style={{ color: '#4F4F4F' }}>{branchName}</strong>
              {clinicName ? ` at ${clinicName}` : ''}.
            </p>
            <div style={{ background: '#F0F9F8', border: '1px solid #A7C4C3', borderRadius: 12, padding: '14px 16px', marginBottom: 24 }}>
              <p style={{ color: '#4F4F4F', fontSize: 13, margin: 0 }}>
                Your branch assignment has been updated. You can now log in to PawSync to start managing your patients.
              </p>
            </div>
            <a
              href="/clinic-login"
              style={{ display: 'inline-block', background: '#5A7C7A', color: 'white', padding: '12px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}
            >
              Go to Login
            </a>
          </>
        )}

        {state === 'error' && (
          <>
            <XCircle style={{ width: 56, height: 56, color: '#EF4444', margin: '0 auto 16px' }} />
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#4F4F4F', marginBottom: 12 }}>Invitation Invalid</h1>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 20, lineHeight: 1.6 }}>
              {errorMessage}
            </p>
            <p style={{ color: '#9CA3AF', fontSize: 13 }}>
              Please contact your clinic administrator if you believe this is an error.
            </p>
          </>
        )}

      </div>
    </div>
  )
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={
      <div style={{ fontFamily: 'Arial, sans-serif', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F6F2' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '40px 32px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
          <p style={{ color: '#5A7C7A', fontWeight: 700, fontSize: 18, marginBottom: 32, letterSpacing: 0.5 }}>PawSync</p>
          <Loader2 style={{ width: 48, height: 48, color: '#5A7C7A', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#4F4F4F', marginBottom: 8 }}>Loading Invitation</h1>
          <p style={{ color: '#9CA3AF', fontSize: 14 }}>Preparing invite details...</p>
          <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    }>
      <AcceptInvitationContent />
    </Suspense>
  )
}
