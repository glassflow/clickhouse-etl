'use client';

import { useEffect } from 'react'
import { loadReoScript } from 'reodotdev'

export function ReoAnalytics() {
    useEffect(() => {
        // Only run reo.dev in production environment
        if (process.env.NODE_ENV !== 'production') {
            console.log('ReoAnalytics: Skipping in development mode')
            return
        }

        const clientID = process.env.NEXT_PUBLIC_REO_CLIENT_ID

        // Don't load if no client ID is provided
        if (!clientID) {
            console.log('ReoAnalytics: No client ID provided, skipping')
            return
        }

        let isMounted = true
        loadReoScript({ clientID })
            .then((Reo) => {
                if (!isMounted) return
                Reo.init({ clientID })
                console.log('ReoAnalytics: Initialized successfully')
            })
            .catch((error) => {
                console.error('Error loading Reo', error)
            })

        return () => {
            isMounted = false
        }
    }, [])

    return null
}
