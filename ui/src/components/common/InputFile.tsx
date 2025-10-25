import { useState, useEffect, useMemo, useRef } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/src/components/ui/input-group'
import { cn } from '@/src/utils/common.client'

export interface InputFileProps {
  id: string
  label?: string
  placeholder?: string
  allowedFileTypes: string[]
  onChange: (fileContent: string, fileName: string) => void
  value?: string
  initialFileName?: string // Allow passing stored filename to display
  readType?: 'text' | 'base64'
  disabled?: boolean
  className?: string
  // Optional features
  showClearButton?: boolean
  showLoadingState?: boolean
  showErrorState?: boolean
  // Optional validation
  onValidate?: (
    content: string,
    fileName: string,
  ) => Promise<{ valid: boolean; error?: string }> | { valid: boolean; error?: string }
  // Optional hint text
  hintText?: string
  // Error from parent
  externalError?: string | null
}

export function InputFile({
  id,
  label,
  placeholder = 'No file selected',
  allowedFileTypes,
  onChange,
  value,
  initialFileName,
  readType = 'text',
  disabled = false,
  className = '',
  showClearButton = true,
  showLoadingState = false,
  showErrorState = false,
  onValidate,
  hintText,
  externalError,
}: InputFileProps) {
  const [fileName, setFileName] = useState<string>(initialFileName || '')
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    setIsLoading(true)
    setError(null)
    setFileName(file.name)

    try {
      const reader = new FileReader()

      reader.onload = async (e) => {
        const content = e.target?.result as string

        // Validate if validation function is provided
        if (onValidate) {
          const validation = await onValidate(content, file.name)
          if (!validation.valid) {
            setError(validation.error || 'Invalid file')
            setIsLoading(false)
            setFileName('')
            return
          }
        }

        setFileContent(content)
        setIsLoading(false)
      }

      reader.onerror = () => {
        setError('Failed to read file')
        setIsLoading(false)
        setFileName('')
      }

      switch (readType) {
        case 'text':
          reader.readAsText(file)
          break
        case 'base64':
          reader.readAsDataURL(file)
          break
        default:
          reader.readAsText(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
      setIsLoading(false)
      setFileName('')
    }
  }

  const handleClear = () => {
    setFileContent('')
    setFileName('')
    setError(null)
    onChange('', '')
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleBrowseClick = () => {
    fileInputRef.current?.click()
  }

  // Create accept attribute, handling special cases for files without extensions
  const acceptSet = useMemo(() => {
    // Filter out empty strings and create the accept attribute
    const validExtensions = allowedFileTypes.filter((ext) => ext && ext.trim() !== '')

    // If no valid extensions, accept all files (for certificates without extensions)
    if (validExtensions.length === 0) {
      return undefined
    }

    return validExtensions.map((accept) => `.${accept}`).join(',')
  }, [allowedFileTypes])

  // Sync with external value and initialFileName
  useEffect(() => {
    if (value !== undefined && value !== fileContent) {
      setFileContent(value)
    }
  }, [value])

  // Sync with initialFileName when it changes (e.g., when navigating back to the form)
  useEffect(() => {
    if (initialFileName !== undefined && initialFileName !== fileName && !fileContent) {
      setFileName(initialFileName)
    }
  }, [initialFileName])

  // Notify parent of changes
  useEffect(() => {
    if (fileContent) {
      onChange(fileContent, fileName)
    }
  }, [fileContent, fileName])

  const displayError = externalError || error

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      {label && <label className="text-sm font-medium text-content">{label}</label>}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        id={id}
        type="file"
        onChange={handleFileChange}
        className="hidden"
        accept={acceptSet}
        disabled={disabled || isLoading}
      />

      <InputGroup
        className={cn(
          'input-border-regular',
          displayError && 'input-border-error',
          // Override default InputGroup focus ring to remove it
          'has-[[data-slot=input-group-control]:focus-visible]:!ring-0',
          // Apply custom focus styling to match other form fields
          'has-[[data-slot=input-group-control]:focus-visible]:!border-[var(--color-background-primary,#a5b9e4)]',
          'has-[[data-slot=input-group-control]:focus-visible]:!shadow-[0_0_0_2px_rgba(165,185,228,0.25)]',
        )}
      >
        <InputGroupInput
          value={fileName}
          placeholder={placeholder}
          readOnly
          disabled={disabled}
          aria-invalid={!!displayError}
        />

        <InputGroupAddon align="inline-end">
          {/* Loading indicator */}
          {showLoadingState && isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

          {/* Clear button */}
          {showClearButton && fileName && !isLoading && (
            <InputGroupButton
              onClick={handleClear}
              disabled={disabled}
              variant="ghost"
              size="icon-xs"
              title="Clear file"
            >
              <X className="h-4 w-4" />
            </InputGroupButton>
          )}

          {/* Browse button */}
          <InputGroupButton onClick={handleBrowseClick} disabled={disabled || isLoading} variant="secondary" size="xs">
            <Upload className="h-3.5 w-3.5" />
            Browse
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Error state */}
      {showErrorState && displayError && <div className="text-sm text-content">{displayError}</div>}

      {/* Hint text */}
      {hintText && <div className="text-xs text-content">{hintText}</div>}
    </div>
  )
}
