'use client'

import { cn } from '@/src/utils/common.client'
import {
  LayoutGridIcon,
  WorkflowIcon,
  DatabaseIcon,
  LayoutListIcon,
  CopyIcon,
  FilterIcon,
  ArrowLeftRightIcon,
  FolderIcon,
  FolderOpenIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TagIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { LibraryFolder } from '@/src/hooks/useLibraryConnections'

export type LibrarySection =
  | 'all'
  | 'kafka'
  | 'clickhouse'
  | 'schemas'
  | 'dedup'
  | 'filter'
  | 'transforms'

export type LibraryCounts = Record<LibrarySection, number>

type Props = {
  activeSection: LibrarySection
  onSectionChange: (s: LibrarySection) => void
  counts: LibraryCounts
  folders: LibraryFolder[]
  selectedFolderId: string | null
  onFolderChange: (id: string | null) => void
  allTags: string[]
  selectedTag: string | null
  onTagChange: (tag: string | null) => void
}

const COMING_SOON_SECTIONS = new Set<LibrarySection>(['dedup', 'filter'])

type SectionDef = {
  key: LibrarySection
  label: string
  icon: React.ElementType
}

const SECTIONS: SectionDef[] = [
  { key: 'all',        label: 'All components',        icon: LayoutGridIcon },
  { key: 'kafka',      label: 'Kafka connections',      icon: WorkflowIcon },
  { key: 'clickhouse', label: 'ClickHouse connections', icon: DatabaseIcon },
  { key: 'schemas',    label: 'Schemas',                icon: LayoutListIcon },
  { key: 'dedup',      label: 'Dedup configs',          icon: CopyIcon },
  { key: 'filter',     label: 'Filter configs',         icon: FilterIcon },
  { key: 'transforms', label: 'Transform configs',      icon: ArrowLeftRightIcon },
]

export function LibrarySideNav({
  activeSection,
  onSectionChange,
  counts,
  folders,
  selectedFolderId,
  onFolderChange,
  allTags,
  selectedTag,
  onTagChange,
}: Props) {
  const [foldersOpen, setFoldersOpen] = useState(true)

  return (
    <aside className="w-56 shrink-0 flex flex-col gap-0 pr-2">
      {/* Section navigation */}
      <div className="flex flex-col gap-0">
        <span className="lib-nav-label">Library</span>
        {SECTIONS.map(({ key, label, icon: Icon }) => {
          const isActive = activeSection === key
          const count = counts[key]
          const isComingSoon = COMING_SOON_SECTIONS.has(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSectionChange(key)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 rounded-md text-left transition-colors caption-1 focus-ring',
                isActive
                  ? 'bg-[var(--option-bg-selected)] text-[var(--color-orange-300)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-bg-hover)] hover:text-[var(--text-primary)]',
              )}
            >
              <Icon size={13} className="shrink-0" />
              <span className="flex-1 truncate">{label}</span>
              {isComingSoon ? (
                <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--text-tertiary)] border border-[var(--surface-border)] rounded px-1 py-0.5 leading-none">
                  soon
                </span>
              ) : count > 0 ? (
                <span
                  className={cn(
                    'text-[10px] font-mono tabular-nums',
                    isActive ? 'text-[var(--color-orange-300)]' : 'text-[var(--text-tertiary)]',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Folders */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setFoldersOpen((o) => !o)}
          className="flex items-center gap-1.5 w-full px-1 py-1 caption-2 text-[var(--text-tertiary)] uppercase tracking-wider hover:text-[var(--text-secondary)] transition-colors focus-ring"
        >
          {foldersOpen ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />}
          Folders
        </button>

        {foldersOpen && (
          <div className="flex flex-col gap-0.5 mt-1">
            <FolderRow
              label="All"
              isSelected={selectedFolderId === null}
              onClick={() => onFolderChange(null)}
              isAll
            />
            {folders.map((f) => (
              <FolderRow
                key={f.id}
                label={f.name}
                isSelected={selectedFolderId === f.id}
                onClick={() => onFolderChange(f.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 px-1 py-1 caption-2 text-[var(--text-tertiary)] uppercase tracking-wider">
            <TagIcon size={10} />
            Tags
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1 px-1">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagChange(selectedTag === tag ? null : tag)}
                className={cn(
                  'caption-1 px-2 py-0.5 rounded-[4px] border transition-colors focus-ring',
                  selectedTag === tag
                    ? 'bg-[var(--option-bg-selected)] border-[var(--color-orange-alpha-20)] text-[var(--color-orange-300)]'
                    : 'bg-transparent border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--color-gray-dark-300)] hover:text-[var(--text-primary)]',
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

function FolderRow({
  label,
  isSelected,
  onClick,
  isAll = false,
}: {
  label: string
  isSelected: boolean
  onClick: () => void
  isAll?: boolean
}) {
  const FIcon = isSelected && !isAll ? FolderOpenIcon : FolderIcon

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-left transition-colors caption-1 focus-ring',
        isSelected
          ? 'text-[var(--text-primary)] bg-[var(--surface-bg-hover)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg-hover)]',
      )}
    >
      <FIcon
        size={12}
        className={isSelected ? 'text-[var(--color-foreground-primary)] shrink-0' : 'text-[var(--text-tertiary)] shrink-0'}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}
