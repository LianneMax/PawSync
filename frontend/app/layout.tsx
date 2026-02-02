import type { Metadata } from 'next'
import { Outfit, Odor_Mean_Chey } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const odorMeanChey = Odor_Mean_Chey({ weight: '400', subsets: ['latin'], variable: '--font-odor-mean-chey' })

export const metadata: Metadata = {
  title: 'PawSync',
  description: 'NFC-Enabled Centralized Pet Medical Record System',
  icons: {
    icon: '/images/logos/pawsync-logo-medium.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${outfit.variable} ${odorMeanChey.variable} ${outfit.className}`}>
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  )
}