'use client';

import { useRef, useCallback, useEffect } from 'react';
import { Search } from 'nextra/components';
import { trackPageview } from 'fathom-client';

/** Virtual page for search tracking; query in path so Fathom shows it in Pages (e.g. /search/install). */
const SEARCH_PAGE = '/search';

const TRACK_DEBOUNCE_MS = 600;
const MAX_QUERY_LENGTH = 80;

function slugifyQuery(query: string): string {
  return query
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'query';
}

function useDebouncedTrackSearch() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTrackedRef = useRef('');

  return useCallback((query: string) => {
    console.log('[Docs Search] input changed:', JSON.stringify(query));
    const trimmed = query?.trim().slice(0, 200) || '';
    if (!trimmed) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      if (lastTrackedRef.current === trimmed) return;
      lastTrackedRef.current = trimmed;
      const slug = slugifyQuery(trimmed);
      const path = `${SEARCH_PAGE}/${slug}`;
      const fullUrl =
        typeof window !== 'undefined' ? `${window.location.origin}${path}` : path;
      console.log('[Docs Search] would send to Fathom (virtual pageview):', fullUrl);
      trackPageview({ url: fullUrl });
    }, TRACK_DEBOUNCE_MS);
  }, []);
}

export function SearchWithTracking() {
  useEffect(() => {
    console.log('[Docs Search] SearchWithTracking mounted');
  }, []);
  const handleSearch = useDebouncedTrackSearch();
  return <Search onSearch={handleSearch} />;
}
