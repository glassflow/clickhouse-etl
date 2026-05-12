'use client'

import { useState, useRef } from 'react'
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
    <div className="flex items-center border-b border-[var(--surface-border)]">
      {/* Scrollable tab strip */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 flex-1 min-w-0">
        {views.map((view) => {
          const isActive = view.id === activeViewId
          const count = getPipelineCount(view)
          return (
            <div key={view.id} className="flex items-center shrink-0">
              <button
                onClick={() => onSelectView(view.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-t-md focus-ring ${
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
                  className="ml-0.5 p-1 text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-critical)] transition-colors focus-ring rounded"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Save view — outside the overflow container so the popover isn't clipped */}
      <div className="relative shrink-0 ml-2 pb-1">
        <button
          onClick={() => {
            setShowSavePopover(true)
            setTimeout(() => inputRef.current?.focus(), 0)
          }}
          className="px-2 py-1.5 text-xs text-[var(--color-foreground-neutral-faded)] hover:text-[var(--color-foreground-primary)] transition-colors focus-ring rounded"
        >
          + Save view
        </button>
        {showSavePopover && (
          <div className="absolute top-full right-0 mt-2 z-50 surface-gradient-border border-0 bg-[var(--color-background-elevation-raised-faded-2)] shadow-lg animate-slideDown w-72 p-4 flex flex-col gap-3">
            <p className="caption-1 text-[var(--color-foreground-neutral-faded)]">Save current filters as a view</p>
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
              className="w-full text-sm bg-transparent border-b border-[var(--surface-border)] focus:outline-none focus:border-[var(--control-border-focus)] text-[var(--color-foreground-neutral)] py-1"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSavePopover(false)}
                className="text-xs text-[var(--color-foreground-neutral-faded)] hover:opacity-70 focus-ring rounded px-2 py-1"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="text-xs text-[var(--color-foreground-primary)] hover:opacity-70 focus-ring rounded px-2 py-1"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
