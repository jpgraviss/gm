'use client'

import { useEffect } from 'react'

/**
 * Root error boundary — catches errors that happen above the app
 * layout (including in the layout itself). Must define <html> and
 * <body> because it replaces the root layout on render.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('GravHub global error boundary caught:', error)
  }, [error])

  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f9fafb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24 }}>
          <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: '#fef2f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                color: '#f87171',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              !
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1f2937', margin: '0 0 8px' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
              An unexpected error broke this page. Reload to try again.
            </p>
            <button
              onClick={reset}
              style={{
                background: '#015035',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
