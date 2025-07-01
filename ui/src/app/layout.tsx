import type { Metadata } from 'next'
import ThemeProvider from '@/src/components/shared/ThemeProvider'
import { Inter, Archivo } from 'next/font/google'
import './globals.css'
import { HeaderStandalone } from '../components/shared/HeaderStandalone'
import { Button } from '@/src/components/ui/button'
import GlobalFooter from '@/src/components/shared/GlobalFooter'
import { ConsentLayout } from '@/src/components/layout/ConsentLayout'
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
      <body className="bg-background text-foreground">
        <Script src="/env.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <ConsentLayout>
            <div className="grid grid-rows-[auto_1fr_auto] h-screen max-h-screen w-full overflow-auto">
              <header className="w-full px-8 sm:px-20 pt-4 shrink-0">
                <div className="max-w-[var(--main-container-width)] mx-auto w-full">
                  <HeaderStandalone />
                </div>
              </header>
              <main className="flex flex-col items-center w-full px-8 sm:px-20 py-8 mt-16 overflow-y-auto">
                <div className="max-w-[1240px] w-full">{children}</div>
              </main>
              <footer className="w-full px-8 sm:px-20 py-6 shrink-0">
                <div className="max-w-[1240px] mx-auto w-full flex gap-6 flex-wrap items-center justify-center">
                  <GlobalFooter />
                </div>
              </footer>
            </div>
            {/* <EnvDebug /> */}
          </ConsentLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
