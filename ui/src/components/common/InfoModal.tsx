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

export function InfoModal({
  visible,
  title,
  description,
  okButtonText,
  cancelButtonText,
  onComplete,
  pendingOperation,
  criticalOperation,
}: {
  visible: boolean
  title: string
  description: string | React.ReactNode
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
      <DialogOverlay className="!fixed !inset-0 modal-overlay surface-gradient-border" aria-hidden="true" />
      <DialogContent className="sm:max-w-[500px] info-modal-container surface-gradient-border border-0">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-8">{title}</DialogTitle>
          <DialogDescription className="modal-description gap-2">{description}</DialogDescription>
        </DialogHeader>
        {/* <DialogContent className="modal-description">this is where the content goes</DialogContent> */}
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
