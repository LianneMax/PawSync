'use client'

import { GoogleOAuthProvider } from '@react-oauth/google'

export default function Providers({ children }: { children: React.ReactNode }) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || 'MISSING_GOOGLE_CLIENT_ID'

  if (googleClientId === 'MISSING_GOOGLE_CLIENT_ID' && process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Sign-In will be unavailable until configured.')
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {children}
    </GoogleOAuthProvider>
  )
}
