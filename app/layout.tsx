import type { Metadata } from 'next'
import { Montserrat, Syncopate } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { UIProvider } from '@/contexts/UIContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/ui/Toast'
import { SettingsProvider } from '@/lib/useSettings'
import AppShell from '@/components/layout/AppShell'
import CookieConsent from '@/components/ui/CookieConsent'
import ServiceWorkerRegistration from '@/components/ui/ServiceWorkerRegistration'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-body',
})

const syncopate = Syncopate({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-heading',
})

export const metadata: Metadata = {
  title: 'GravHub — Run Your Agency Like a Machine',
  description: 'Every lead. Every dollar. Every renewal. Zero gaps. The operating system that turns chaos into closed deals.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${montserrat.variable} ${syncopate.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="theme-color" content="#015035" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="GravHub" />
        {/* Google Identity Services */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script id="google-gsi" src="https://accounts.google.com/gsi/client" async defer />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <UIProvider>
              <ToastProvider>
                <SettingsProvider>
                  <AppShell>
                    {children}
                  </AppShell>
                  <CookieConsent />
                  <ServiceWorkerRegistration />
                </SettingsProvider>
              </ToastProvider>
            </UIProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
