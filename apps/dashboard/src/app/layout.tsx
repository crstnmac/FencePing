import React from 'react'
import type { Metadata } from 'next'
import { Inter } from "next/font/google"
import { QueryProvider } from '../providers/QueryProvider'
import { SocketProvider } from '../providers/SocketProvider'
import { AuthProvider } from '../contexts/AuthContext'
import { AppContent } from '../components/AppContent'
import { Toaster } from 'react-hot-toast'
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
            <SocketProvider>
              <AppContent>
                {children}
              </AppContent>
            </SocketProvider>
          </AuthProvider>
        </QueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}