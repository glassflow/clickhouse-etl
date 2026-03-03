import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'

export const ModalResult = {
  CANCEL: 'CANCEL',
  YES: 'YES',
  NO: 'NO',
}

export function ConfirmationModal({
  visible,
  title,
  description,
  content,
  okButtonText,
  cancelButtonText,
  onComplete,
  pendingOperation,
  criticalOperation,
}: {
  visible: boolean
  title: string
  description: string
  content?: React.ReactNode
  okButtonText: string
  cancelButtonText: string
  onComplete: (result: string, pendingOperation: string) => void
  pendingOperation?: string
  criticalOperation?: boolean
}) {
  return (
    <Dialog
      open={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen) onComplete(ModalResult.NO, pendingOperation || '')
      }}
    >
      <DialogOverlay
        className="!fixed !inset-0"
        aria-hidden="true"
        style={{
          backgroundColor: 'rgba(17, 25, 40, 0.25)',
          backdropFilter: 'blur(4px) saturate(30%)',
          WebkitBackdropFilter: 'blur(4px) saturate(30%)',
          border: '1px solid rgba(255, 255, 255, 0.125)',
        }}
      />
      <DialogContent className="sm:max-w-[500px] info-modal-container surface-gradient-border border-0">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-8">{title}</DialogTitle>
          <DialogDescription className="modal-description text-sm mb-4">
            <div dangerouslySetInnerHTML={{ __html: description }} />
          </DialogDescription>
        </DialogHeader>

        {content && <div className="mb-6">{content}</div>}

        <DialogFooter className="mt-6">
          <Button
            variant="tertiary"
            onClick={() => {
              onComplete(ModalResult.NO, pendingOperation || '')
            }}
          >
            {cancelButtonText}
          </Button>
          <Button
            variant={criticalOperation ? 'destructive' : 'primary'}
            onClick={() => {
              onComplete(ModalResult.YES, pendingOperation || '')
            }}
          >
            {okButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
