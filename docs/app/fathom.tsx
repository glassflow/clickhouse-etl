'use client';

import { load, trackPageview } from 'fathom-client';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

function TrackPageView() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Load Fathom in both development and production
        load(process.env.NEXT_PUBLIC_FATHOM_ID, {
            auto: false,
        });
    }, []);

    useEffect(() => {
        if (!pathname) return;

        // Track pageviews in both development and production
        trackPageview({
            url: pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : ''),
            referrer: document.referrer
        });
    }, [pathname, searchParams]);

    return null;
}

export function FathomAnalytics() {
    // Only render in production or if explicitly enabled in development
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_FATHOM_DEV !== 'true') {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <TrackPageView />
        </Suspense>
    );
}
