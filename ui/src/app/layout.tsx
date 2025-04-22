import type { Metadata } from 'next'
import ThemeProvider from '@/src/components/ThemeProvider'
import { Inter, Archivo } from 'next/font/google'
import './globals.css'
import { HeaderStandalone } from '../components/common/HeaderStandalone'
import { Button } from '@/src/components/ui/button'
import GlobalFooter from '@/src/components/GlobalFooter'
import { ConsentLayout } from '@/src/components/layout/ConsentLayout'

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
        <ThemeProvider>
          <ConsentLayout>
            <div className="grid grid-rows-[auto_1fr_auto] min-h-screen w-full">
              <header className="w-full px-8 sm:px-20">
                <div className="max-w-[var(--main-container-width)] mx-auto w-full">
                  <HeaderStandalone />
                </div>
              </header>
              <main className="flex flex-col gap-8 items-center justify-start w-full px-8 sm:px-20 py-16">
                <div className="max-w-[1240px] w-full">{children}</div>
              </main>
              <footer className="w-full px-8 sm:px-20">
                <div className="max-w-[1240px] mx-auto w-full flex gap-6 flex-wrap items-center justify-center">
                  <GlobalFooter />
                </div>
              </footer>
            </div>
          </ConsentLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
