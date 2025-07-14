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
import { ModalResult } from '@/src/components/common/Modal'

export function FormModal({
  visible,
  title,
  description,
  inputLabel,
  secondaryLabel,
  inputPlaceholder,
  submitButtonText,
  cancelButtonText,
  onComplete,
  onChange,
  initialValue = '',
  validation,
}: {
  visible: boolean
  title: string
  description: string
  inputLabel: string
  secondaryLabel: string
  inputPlaceholder: string
  submitButtonText: string
  cancelButtonText: string
  onComplete: (result: string, value?: string) => void
  onChange?: (value: string) => void
  initialValue?: string
  validation?: (value: string) => string | null
}) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)

  // Reset input value when modal becomes visible
  useEffect(() => {
    if (visible) {
      setInputValue(initialValue)
      setError(null)
    }
  }, [visible, initialValue])

  const handleSubmit = () => {
    if (validation) {
      const validationError = validation(inputValue)
      if (validationError) {
        setError(validationError)
        return
      }
    }
    onComplete(ModalResult.YES, inputValue || '')
  }

  const handleCancel = () => {
    onComplete(ModalResult.CANCEL)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
    setError(null)

    if (onChange) {
      onChange(e.target.value)
    }
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
      <DialogContent className="sm:max-w-[500px] info-modal-container px-9 py-6 shadow-lg bg-[var(--color-background-elevation-raised-faded-2)] border border-[var(--color-border-neutral)] rounded-md">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">{title}</DialogTitle>
          <DialogDescription className="modal-description mb-4">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">{inputLabel}</label>
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={inputPlaceholder}
            className={error ? 'border-red-500' : 'input-regular input-border-regular'}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <label className="text-sm font-medium text-muted-foreground">{secondaryLabel}</label>
        </div>

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
