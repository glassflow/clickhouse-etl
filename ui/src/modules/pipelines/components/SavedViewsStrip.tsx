'use client'

import React, { useState, useRef } from 'react'
import type { SavedView } from '../hooks/useSavedViews'

interface SavedViewsStripProps {
  views: SavedView[]
  activeViewId: string
  onSelectView: (id: string) => void
  onSaveCurrentView: (name: string) => void
  onDeleteView: (id: string) => void
  getPipelineCount: (view: SavedView) => number
}

export function SavedViewsStrip({
  views,
  activeViewId,
  onSelectView,
  onSaveCurrentView,
  onDeleteView,
  getPipelineCount,
}: SavedViewsStripProps) {
  const [showSavePopover, setShowSavePopover] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    const name = newViewName.trim()
    if (!name) return
    onSaveCurrentView(name)
    setNewViewName('')
    setShowSavePopover(false)
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--surface-border)]">
      {views.map((view) => {
        const isActive = view.id === activeViewId
        const count = getPipelineCount(view)
        return (
          <div key={view.id} className="flex items-center shrink-0">
            <button
              onClick={() => onSelectView(view.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-t-md ${
                isActive
                  ? 'active text-[var(--color-foreground-primary)] border-b-2 border-[var(--color-foreground-primary)]'
                  : 'text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-neutral)]'
              }`}
            >
              {view.name}
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--surface-bg)] border border-[var(--surface-border)]">
                {count}
              </span>
            </button>
            {!view.isBuiltIn && (
              <button
                aria-label={`Delete view ${view.name}`}
                onClick={() => onDeleteView(view.id)}
                className="ml-0.5 p-1 text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-critical)] transition-colors"
              >
                ×
              </button>
            )}
          </div>
        )
      })}

      {/* Save view */}
      <div className="relative shrink-0 ml-2">
        <button
          onClick={() => {
            setShowSavePopover(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="px-2 py-1.5 text-xs text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-primary)] transition-colors"
        >
          + Save view
        </button>
        {showSavePopover && (
          <div className="absolute top-full left-0 mt-1 z-10 bg-[var(--surface-bg)] border border-[var(--surface-border)] rounded-lg p-3 shadow-lg flex items-center gap-2 min-w-[220px]">
            <input
              ref={inputRef}
              type="text"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setShowSavePopover(false)
              }}
              placeholder="View name…"
              className="flex-1 text-sm bg-transparent border-b border-[var(--surface-border)] focus:outline-none focus:border-[var(--control-border-focus)] text-[var(--color-foreground-neutral)]"
            />
            <button
              onClick={handleSave}
              className="text-xs text-[var(--color-foreground-primary)] hover:opacity-70"
            >
              Save
            </button>
            <button
              onClick={() => setShowSavePopover(false)}
              className="text-xs text-[var(--color-foreground-neutral-faded)] hover:opacity-70"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
