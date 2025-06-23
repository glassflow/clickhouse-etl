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
}

export const TableContextMenu = ({ onPause, onEdit, onRename, onDelete, disabled = false }: TableContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleButtonClick = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleMenuClick = (action: () => void | undefined) => {
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
          <div className="absolute right-0 top-full mt-1 z-20 w-48 bg-[var(--color-background-regular)] border border-[var(--color-border-neutral)] rounded-md shadow-lg p-1 min-w-[160px]">
            {onPause && (
              <Button
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={() => handleMenuClick(onPause)}
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {onEdit && (
              <Button
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={() => handleMenuClick(onEdit)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}

            {onRename && (
              <Button
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-foreground hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={() => handleMenuClick(onRename)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Rename
              </Button>
            )}

            {onDelete && (
              <Button
                className="flex justify-start items-center w-full px-3 py-2 text-sm text-destructive hover:bg-[var(--color-background-neutral-faded)] transition-colors"
                onClick={() => handleMenuClick(onDelete)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
