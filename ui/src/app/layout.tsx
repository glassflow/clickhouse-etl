import type { Metadata } from 'next'
import ThemeProvider from '@/src/components/shared/ThemeProvider'
import { Inter, Archivo } from 'next/font/google'
import './globals.css'
import { Header } from '../components/shared/Header'
import { HeaderWrapper } from '../components/shared/HeaderWrapper'
import { Button } from '@/src/components/ui/button'
import GlobalFooter from '@/src/components/shared/GlobalFooter'
import { AnalyticsProvider } from '@/src/components/providers/AnalyticsProvider'
import { HealthCheckProvider } from '@/src/components/providers/HealthCheckProvider'
import { PlatformProvider } from '@/src/contexts/PlatformContext'
import { Toaster } from '@/src/components/ui/sonner'
import { NotificationProvider } from '@/src/components/providers/NotificationProvider'
import { AuthProvider } from '@/src/components/providers/AuthProvider'
import Script from 'next/script'
// import { EnvDebug } from '@/src/components/debug/EnvDebug'

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
    <html lang="en" className={`${inter.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="shortcut icon" href="/favicon.svg" />
      </head>
      <body className="background text-foreground">
        <Script src="/env.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <AnalyticsProvider>
            <HealthCheckProvider>
              <PlatformProvider>
                <NotificationProvider>
                  <AuthProvider>
                    <HeaderWrapper>
                      <Header />
                    </HeaderWrapper>
                    <main className="flex flex-col items-center w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-8 overflow-x-hidden overflow-y-auto">
                      <div className="w-full max-w-[1240px] mx-auto px-4 sm:px-0">{children}</div>
                    </main>
                    <footer className="w-full px-4 sm:px-8 lg:px-20 py-4 sm:py-6 shrink-0">
                      <div className="max-w-[1240px] mx-auto w-full flex gap-6 flex-wrap items-center justify-center">
                        {/* <GlobalFooter /> */}
                      </div>
                    </footer>
                    <Toaster />
                  </AuthProvider>
                </NotificationProvider>
              </PlatformProvider>
            </HealthCheckProvider>
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
