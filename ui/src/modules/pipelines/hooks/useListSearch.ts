'use client'

import { useState, useCallback } from 'react'
import type { ListPipelineConfig } from '@/src/types/pipeline'

export function useListSearch() {
  const [searchQuery, setSearchQuery] = useState('')

  const clearSearch = useCallback(() => setSearchQuery(''), [])

  const filterBySearch = useCallback(
    (pipelines: ListPipelineConfig[]): ListPipelineConfig[] => {
      const trimmed = searchQuery.trim()
      if (!trimmed) return pipelines
      const q = trimmed.toLowerCase()
      return pipelines.filter((p) => p.name.toLowerCase().includes(q))
    },
    [searchQuery],
  )

  return { searchQuery, setSearchQuery, clearSearch, filterBySearch }
}
