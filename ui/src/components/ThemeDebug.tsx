'use client'

import { useTheme } from 'next-themes'

export function ThemeDebug() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="fixed bottom-4 right-4 p-4 bg-card border border-border rounded-md shadow-md z-50">
      <p className="body-3 mb-2">Current theme: {theme}</p>
      <div className="flex gap-2">
        <button onClick={() => setTheme('light')} className="px-3 py-1 bg-primary text-primary-foreground rounded">
          Light
        </button>
        <button onClick={() => setTheme('dark')} className="px-3 py-1 bg-primary text-primary-foreground rounded">
          Dark
        </button>
      </div>
    </div>
  )
}
