import { Button } from '@/src/components/ui/button'
import { DeleteIcon, RenameIcon, PauseIcon, RestartIcon } from '@/src/components/icons'
import classnames from 'classnames'

const actionIcons = {
  rename: RenameIcon,
  delete: DeleteIcon,
  pause: PauseIcon,
  restart: RestartIcon,
}

const actionLabels = {
  rename: 'Rename',
  delete: 'Delete',
  pause: 'Pause',
  restart: 'Restart',
}

function ActionButton({
  action,
  className,
  variant = 'default',
}: {
  action: 'rename' | 'delete' | 'pause' | 'restart'
  className?: string
  variant?: 'default' | 'active' | 'disabled'
}) {
  const IconComponent = actionIcons[action]

  return (
    <Button variant="outline" className={classnames('btn-action', className)}>
      <IconComponent className={classnames('action-icon', `action-icon--${variant}`)} size={16} />
      {actionLabels[action]}
    </Button>
  )
}

export default ActionButton
