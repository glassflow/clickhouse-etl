'use client'

import { useTheme } from "nextra-theme-docs"
import { useState, useEffect } from "react"

export const Logo = () => {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // During SSR and initial render, use the default logo
    if (!mounted) {
        return (
            <img
                src="/assets/logo.svg"
                alt="GlassFlow Logo"
                style={{ height: '18px' }}
            />
        )
    }

    return (
        <img
            src={resolvedTheme === 'dark' ? '/assets/logo.svg' : '/assets/logo-black.svg'}
            alt="GlassFlow Logo"
            style={{ height: '18px' }}
        />
    )
}
