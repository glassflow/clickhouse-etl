'use client';

import { useEffect } from 'react'
import { loadReoScript } from 'reodotdev'

export function ReoAnalytics() {
    useEffect(() => {
        const clientID = process.env.NEXT_PUBLIC_REO_CLIENT_ID

        let isMounted = true
        loadReoScript({ clientID })
            .then((Reo) => {
                if (!isMounted) return
                Reo.init({ clientID })
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
