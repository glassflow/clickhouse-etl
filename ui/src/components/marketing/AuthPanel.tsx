'use client'

import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
        fill="currentColor"
        opacity=".9"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
        fill="currentColor"
        opacity=".7"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
        fill="currentColor"
        opacity=".5"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
        fill="currentColor"
        opacity=".6"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z" />
    </svg>
  )
}

export function AuthPanel() {
  const [email, setEmail] = useState('')

  function handleEmailSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const params = new URLSearchParams({ login_hint: email })
    window.location.href = `/api/auth/login?${params}`
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h2 className="title-4" style={{ color: 'var(--text-heading)' }}>
          Welcome
        </h2>
        <p className="body-2" style={{ color: 'var(--text-secondary)' }}>
          To prevent spam and bots, you must sign in to access the GlassFlow Public Demo.
        </p>
      </div>

      {/* Social auth buttons */}
      <div className="flex flex-col gap-3">
        <Button variant="secondary" size="default" asChild className="w-full justify-center gap-3">
          <a href="/api/auth/login?connection=google-oauth2">
            <GoogleIcon />
            Continue with Google
          </a>
        </Button>
        <Button variant="secondary" size="default" asChild className="w-full justify-center gap-3">
          <a href="/api/auth/login?connection=github-com">
            <GitHubIcon />
            Continue with GitHub
          </a>
        </Button>
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: 'var(--surface-border)' }} />
        <span className="caption-1 uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
          or
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--surface-border)' }} />
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className="caption-1" style={{ color: 'var(--text-secondary)' }}>
            Email address
          </label>
          <Input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <Button variant="primary" size="default" type="submit" className="w-full">
          Continue
        </Button>
      </form>

      {/* Sign up link */}
      <p className="body-3 text-center" style={{ color: 'var(--text-secondary)' }}>
        Don&apos;t have an account?{' '}
        <a
          href="/api/auth/login?screen_hint=signup"
          className="body-3 underline underline-offset-2"
          style={{ color: 'var(--text-accent)' }}
        >
          Sign up
        </a>
      </p>
    </div>
  )
}
