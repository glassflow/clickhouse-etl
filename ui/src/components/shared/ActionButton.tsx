import { Button } from '@/src/components/ui/button'
import { DeleteIcon, RenameIcon, PauseIcon, RestartIcon, CreateIcon, EditIcon } from '@/src/components/icons'
import classnames from 'classnames'

const actionIcons = {
  rename: RenameIcon,
  delete: DeleteIcon,
  pause: PauseIcon,
  restart: RestartIcon,
  create: CreateIcon,
  edit: EditIcon,
}

const actionLabels = {
  rename: 'Rename',
  delete: 'Delete',
  pause: 'Pause',
  restart: 'Restart',
  create: 'Create',
  edit: 'Edit',
}

function ActionButton({
  action,
  className,
  variant = 'default',
  onClick,
}: {
  action: 'rename' | 'delete' | 'pause' | 'restart' | 'create' | 'edit'
  className?: string
  variant?: 'default' | 'active' | 'disabled'
  onClick?: () => void
}) {
  const IconComponent = actionIcons[action]

  return (
    <Button variant="outline" className={classnames('btn-action', className)} onClick={onClick}>
      <IconComponent className={classnames('action-icon', `action-icon--${variant}`)} size={16} />
      {actionLabels[action]}
    </Button>
  )
}

export default ActionButton
