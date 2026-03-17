'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { MERMAID_THEME_VARS } from './theme'

interface Props {
  chart: string
}

export function Mermaid({ chart }: Props) {
  const id = useId().replace(/:/g, '')
  const ref = useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted || !ref.current) return

    let cancelled = false

    async function render() {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme: resolvedTheme === 'dark' ? 'dark' : 'neutral',
        themeVariables: resolvedTheme === 'dark'
          ? MERMAID_THEME_VARS.dark
          : MERMAID_THEME_VARS.light,
        flowchart: { curve: 'basis', padding: 20 },
      })

      const { svg } = await mermaid.render(`mermaid-${id}`, chart)
      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg
      }
    }

    render()
    return () => { cancelled = true }
  }, [chart, id, mounted, resolvedTheme])

  if (!mounted) return null

  return (
    <div
      ref={ref}
      style={{ display: 'flex', justifyContent: 'center', margin: '24px 0', overflowX: 'auto' }}
    />
  )
}
