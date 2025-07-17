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
import { Input } from '@/src/components/ui/input'
import { Checkbox } from '@/src/components/ui/checkbox'
import { useState, useEffect } from 'react'

export const ModalResult = {
  CANCEL: 'CANCEL',
  SUBMIT: 'SUBMIT',
}

export function InputModal({
  visible,
  title,
  description,
  inputLabel,
  inputPlaceholder,
  submitButtonText,
  cancelButtonText,
  onComplete,
  pendingOperation,
  initialValue = '',
  validation,
  showSaveOption = false,
}: {
  visible: boolean
  title: string
  description: string
  inputLabel: string
  inputPlaceholder: string
  submitButtonText: string
  cancelButtonText: string
  onComplete: (result: string, value: string, pendingOperation: string) => void
  pendingOperation: string
  initialValue?: string
  validation?: (value: string) => string | null
  showSaveOption?: boolean
}) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [shouldSave, setShouldSave] = useState(false)

  // Reset input value when modal becomes visible
  useEffect(() => {
    if (visible) {
      setInputValue(initialValue)
      setError(null)
      setShouldSave(false)
    }
  }, [visible, initialValue])

  const handleSubmit = () => {
    if (shouldSave) {
      if (validation) {
        const validationError = validation(inputValue)
        if (validationError) {
          setError(validationError)
          return
        }
      }
    }
    onComplete(ModalResult.SUBMIT, shouldSave ? inputValue : '', pendingOperation)
  }

  const handleCancel = () => {
    onComplete(ModalResult.CANCEL, '', pendingOperation)
  }

  return (
    <Dialog
      open={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel()
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
      <DialogContent className="sm:max-w-[500px] info-modal-container px-9 py-6 shadow-lg">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">{title}</DialogTitle>
          <DialogDescription className="modal-description mb-4">{description}</DialogDescription>
        </DialogHeader>

        {showSaveOption && (
          <div className="flex items-center space-x-2 mb-4">
            <Checkbox
              id="save-config"
              checked={shouldSave}
              onCheckedChange={(checked) => setShouldSave(checked as boolean)}
            />
            <label
              htmlFor="save-config"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Save this configuration
            </label>
          </div>
        )}

        {showSaveOption && shouldSave && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{inputLabel}</label>
            <Input
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value)
                setError(null)
              }}
              placeholder={inputPlaceholder}
              className={error ? 'border-red-500' : ''}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" className="btn-tertiary" onClick={handleCancel}>
            {cancelButtonText}
          </Button>
          <Button className="btn-primary" onClick={handleSubmit}>
            {submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
