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
          fontFamily: 'var(--font-family-body, system-ui, sans-serif)',
          background: 'var(--color-background-page)',
          color: 'var(--color-foreground-neutral)',
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
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'linear-gradient(180deg, var(--button-primary-gradient-start) 0%, var(--button-primary-gradient-end) 100%)',
              color: 'var(--button-primary-text)',
              cursor: 'pointer',
              boxShadow: 'var(--button-primary-shadow)',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
