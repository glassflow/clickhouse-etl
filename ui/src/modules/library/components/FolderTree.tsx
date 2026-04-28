'use client'

import { FolderIcon, FolderOpenIcon } from 'lucide-react'
import type { LibraryFolder } from '@/src/hooks/useLibraryConnections'

// ─── Props ────────────────────────────────────────────────────────────────────

type FolderTreeProps = {
  folders: LibraryFolder[]
  selectedFolderId: string | null
  onSelect: (id: string | null) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FolderTree({ folders, selectedFolderId, onSelect }: FolderTreeProps) {
  const isAllSelected = selectedFolderId === null

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Folders">
      {/* All items entry */}
      <FolderItem
        label="All"
        isSelected={isAllSelected}
        onClick={() => onSelect(null)}
        isAll
      />

      {/* Individual folders */}
      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          label={folder.name}
          isSelected={selectedFolderId === folder.id}
          onClick={() => onSelect(folder.id)}
        />
      ))}
    </nav>
  )
}

// ─── Item sub-component ───────────────────────────────────────────────────────

function FolderItem({
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
  const Icon = isSelected && !isAll ? FolderOpenIcon : FolderIcon

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex items-center gap-2 w-full px-3 py-2 rounded-md text-left transition-colors',
        'body-3',
        isSelected
          ? 'text-[var(--text-primary)] bg-[var(--surface-bg-hover)]'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-bg-hover)]',
      ].join(' ')}
    >
      <Icon
        size={14}
        className={isSelected ? 'text-[var(--color-foreground-primary)]' : 'text-[var(--text-tertiary)]'}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}
