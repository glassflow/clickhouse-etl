'use client'

import { ThemeProvider as NextThemeProvider } from 'next-themes'
import { type ThemeProviderProps } from 'next-themes'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
      // @ts-expect-error - FIXME: fix this later
      suppressHydrationWarning
    >
      {children}
    </NextThemeProvider>
  )
}
