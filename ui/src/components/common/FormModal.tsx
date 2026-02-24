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
import { Label } from '@/src/components/ui/label'
import { Checkbox } from '@/src/components/ui/checkbox'
import { useState, useEffect } from 'react'
import { ModalResult } from '@/src/components/common/InfoModal'

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
  isLoading = false,
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
  validation?: (value: string) => string | null | Promise<string | null>
  isLoading?: boolean
}) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  // Reset input value when modal becomes visible
  useEffect(() => {
    if (visible) {
      setInputValue(initialValue)
      setError(null)
      setIsValidating(false)
    }
  }, [visible, initialValue])

  const handleSubmit = async () => {
    if (validation) {
      setIsValidating(true)
      try {
        const validationError = await validation(inputValue)
        if (validationError) {
          setError(validationError)
          setIsValidating(false)
          return
        }
      } catch (error) {
        setError('Validation failed')
        setIsValidating(false)
        return
      }
      setIsValidating(false)
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

  const isSubmitDisabled = isLoading || isValidating

  return (
    <Dialog
      open={visible}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancel()
      }}
    >
      <DialogOverlay className="!fixed !inset-0 modal-overlay" aria-hidden="true" />
      <DialogContent className="info-modal-container surface-gradient-border border-0">
        <DialogHeader>
          <DialogTitle className="modal-title flex items-center gap-2 mb-4">{title}</DialogTitle>
          <DialogDescription className="modal-description mb-4">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--color-foreground-neutral-faded)]">{inputLabel}</Label>
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder={inputPlaceholder}
              error={!!error}
              disabled={isLoading}
            />
            {error && <p className="text-sm input-description-error">{error}</p>}
          </div>
          <div className="grid gap-2">
            <Label className="text-sm text-[var(--color-foreground-neutral-faded)]">{secondaryLabel}</Label>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="tertiary" onClick={handleCancel} disabled={isSubmitDisabled}>
            {cancelButtonText}
          </Button>
          <Button
            variant="primary"
            size="custom"
            onClick={handleSubmit}
            disabled={isSubmitDisabled}
            title={isSubmitDisabled ? 'Please wait for validation to complete' : undefined}
          >
            {isValidating ? 'Validating...' : isLoading ? 'Loading...' : submitButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
