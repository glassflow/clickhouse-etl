// This helper is specifically for Server Components to read runtime environment variables.
// Next.js inlines NEXT_PUBLIC_* variables at build time, so process.env in a server component
// will reflect the build-time value unless explicitly read at runtime.
export function isAuthEnabled(): boolean {
  // 1. Check server-side only variable (AUTH0_ENABLED)
  // This is NOT inlined by Next.js and will be read from the actual process.env at runtime
  if (process.env.AUTH0_ENABLED === 'true') {
    return true
  }

  // 2. Fallback to NEXT_PUBLIC variable
  // This might be inlined during build, so it's less reliable for runtime switching
  const authEnabled = process.env.NEXT_PUBLIC_AUTH0_ENABLED
  return authEnabled === 'true'
}
