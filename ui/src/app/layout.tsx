import { Suspense } from 'react'
import type { Metadata } from 'next'
import ThemeProvider from '@/src/components/shared/ThemeProvider'
import { Inter, Archivo } from 'next/font/google'
import './globals.css'
import { Header } from '../components/shared/Header'
import { HeaderWrapper } from '../components/shared/HeaderWrapper'
import { AnalyticsProvider } from '@/src/components/providers/AnalyticsProvider'
import { HealthCheckProvider } from '@/src/components/providers/HealthCheckProvider'
import { PlatformProvider } from '@/src/contexts/PlatformContext'
import { Toaster } from '@/src/components/ui/sonner'
import { NotificationProvider } from '@/src/components/providers/NotificationProvider'
import { AuthProvider } from '@/src/components/providers/AuthProvider'
import { ObservabilityProvider } from '@/src/components/providers/ObservabilityProvider'
import { NotificationsPanel } from '@/src/components/notifications/NotificationsPanel'
import Script from 'next/script'

// Define the fonts
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Glassflow Create Pipeline',
  description: 'Create a new pipeline with ready-to-use data operations',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} bg-[var(--page-background)]`}
      suppressHydrationWarning
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body className="page-background">
        <Script src="/env.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <ObservabilityProvider>
            <AnalyticsProvider>
              <HealthCheckProvider>
                <PlatformProvider>
                  <NotificationProvider>
                    <AuthProvider>
                      <HeaderWrapper>
                        <Suspense fallback={<header className="w-full shrink-0 h-14 bg-[var(--elevated-background)]" aria-hidden />}>
                          <Header />
                        </Suspense>
                      </HeaderWrapper>
                      <main className="flex flex-col w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-8 overflow-x-hidden overflow-y-auto">
                        <div className="grow container mx-auto px-4 sm:px-0">{children}</div>
                      </main>
                      <footer className="w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-6 shrink-0">
                        <div className="grow container mx-auto px-4 sm:px-0 flex gap-6 flex-wrap items-center justify-center">
                          {/* <GlobalFooter /> */}
                        </div>
                      </footer>
                      <Toaster />
                      <NotificationsPanel />
                    </AuthProvider>
                  </NotificationProvider>
                </PlatformProvider>
              </HealthCheckProvider>
            </AnalyticsProvider>
          </ObservabilityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
