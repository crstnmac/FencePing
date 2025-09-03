import React from 'react'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { QueryProvider } from '../providers/QueryProvider'
import { AuthProvider } from '../contexts/AuthContext'
import { AppContent } from '../components/AppContent'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'GeoFence Webhooks',
  description: 'Location-based automation platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>
        <QueryProvider>
          <AuthProvider>
            <AppContent>
              {children}
            </AppContent>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}