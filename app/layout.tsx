import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { UIProvider } from '@/contexts/UIContext'
import { ToastProvider } from '@/components/ui/Toast'
import AppShell from '@/components/layout/AppShell'

export const metadata: Metadata = {
  title: 'GravHub — Graviss Marketing OS',
  description: 'Unified internal operating system for Graviss Marketing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&family=Syncopate:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Google Identity Services */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script id="google-gsi" src="https://accounts.google.com/gsi/client" async defer />
      </head>
      <body>
        <AuthProvider>
          <UIProvider>
            <ToastProvider>
              <AppShell>
                {children}
              </AppShell>
            </ToastProvider>
          </UIProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
