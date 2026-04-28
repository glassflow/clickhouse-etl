import type { Metadata } from 'next'
import ThemeProvider from '@/src/components/shared/ThemeProvider'
import { Inter, Archivo } from 'next/font/google'
import './globals.css'
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
  title: 'Glassflow',
  description: 'Real-time data pipeline platform',
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
                      {children}
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
