// This helper is specifically for Server Components to read runtime environment variables.
// Next.js inlines NEXT_PUBLIC_* variables at build time, so process.env in a server component
// will reflect the build-time value unless explicitly read at runtime.
export function isAuthEnabled(): boolean {
  // 1. Check server-side only variable (AUTH0_ENABLED) - PRIMARY SOURCE OF TRUTH
  // This is NOT inlined by Next.js and will be read from the actual process.env at runtime
  const serverAuth = process.env.AUTH0_ENABLED

  // If AUTH0_ENABLED is explicitly set (either 'true' or 'false'), use it
  if (serverAuth !== undefined && serverAuth !== '') {
    return serverAuth === 'true'
  }

  // 2. Fallback to NEXT_PUBLIC variable for backward compatibility
  // This should only happen in edge cases where AUTH0_ENABLED is not set
  // Note: startup.sh now syncs NEXT_PUBLIC_AUTH0_ENABLED to match AUTH0_ENABLED
  const publicAuth = process.env.NEXT_PUBLIC_AUTH0_ENABLED
  return publicAuth === 'true'
}
