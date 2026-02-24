'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#1a1a1a',
          color: '#e5e5e5',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.75rem' }}>Something went wrong</h1>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem', opacity: 0.9 }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              borderRadius: '0.375rem',
              border: 'none',
              background: 'linear-gradient(180deg, #FFA959 0%, #E7872E 100%)',
              color: '#000',
              cursor: 'pointer',
              boxShadow: '0px 0px 4px 0px rgba(0,0,0,0.20), 0px 4px 8px 0px rgba(0,0,0,0.30)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
