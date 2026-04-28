/**
 * Next.js instrumentation hook — runs once on server startup before any request is served.
 * Used to run database migrations so tables exist before the library API routes are hit.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runMigrations } = await import('@/src/lib/db/migrate')
    await runMigrations()
  }
}
