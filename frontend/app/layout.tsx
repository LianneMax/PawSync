import type { Metadata } from 'next'
import { Outfit, Odor_Mean_Chey } from 'next/font/google'
import './globals.css'

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' })
const odorMeanChey = Odor_Mean_Chey({ weight: '400', subsets: ['latin'], variable: '--font-odor-mean-chey' })

export const metadata: Metadata = {
  title: 'PawSync',
  description: 'NFC-Enabled Centralized Pet Medical Record System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${outfit.variable} ${odorMeanChey.variable} ${outfit.className}`}>{children}</body>
    </html>
  )
}