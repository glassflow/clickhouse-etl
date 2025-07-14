import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { MoreVertical, Pause, Edit, FileText, Trash2 } from 'lucide-react'
import { cn } from '@/src/utils'

interface TableContextMenuProps {
  onPause?: () => void
  onEdit?: () => void
  onRename?: () => void
  onDelete?: () => void
  disabled?: boolean
  onOpen?: (e: React.MouseEvent) => void // Optional, for extensibility
}

export const TableContextMenu = ({
  onPause,
  onEdit,
  onRename,
  onDelete,
  disabled = false,
  onOpen,
}: TableContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click
    if (onOpen) onOpen(e)
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleMenuClick = (e: React.MouseEvent, action: () => void | undefined) => {
    e.stopPropagation()

    if (action) {
      action()
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-8 w-8 p-0 hover:bg-muted', disabled && 'opacity-50 cursor-not-allowed')}
        onClick={handleButtonClick}
        disabled={disabled}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Menu dropdown */}
          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--color-background-regular)] border border-[var(--color-border-neutral)] rounded-md shadow-lg p-1 min-w-[160px] sm:min-w-[180px]">
            {onPause && (
              <Button
                variant="ghost"
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={(e) => handleMenuClick(e, onPause)}
              >
                <Pause className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Pause</span>
              </Button>
            )}

            {onEdit && (
              <Button
                variant="ghost"
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={(e) => handleMenuClick(e, onEdit)}
              >
                <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Edit</span>
              </Button>
            )}

            {onRename && (
              <Button
                variant="ghost"
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={(e) => handleMenuClick(e, onRename)}
              >
                <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Rename</span>
              </Button>
            )}

            {onDelete && (
              <Button
                variant="ghost"
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-destructive hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={(e) => handleMenuClick(e, onDelete)}
              >
                <Trash2 className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">Delete</span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
