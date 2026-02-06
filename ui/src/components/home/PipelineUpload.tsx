'use client'

import { useState, useRef, useCallback } from 'react'
import { ArrowUpTrayIcon, DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/src/utils/common.client'
import { Button } from '@/src/components/ui/button'
import { Textarea } from '@/src/components/ui/textarea'
import {
  parsePipelineConfigJson,
  validateFileSize,
  readFileAsText,
  type ImportValidationResult,
} from '@/src/utils/pipeline-import'

export interface PipelineUploadProps {
  onValidConfig: (result: ImportValidationResult, rawJson: string) => void
  onError: (errors: string[]) => void
  disabled?: boolean
}

type InputMode = 'file' | 'paste'

export function PipelineUpload({ onValidConfig, onError, disabled = false }: PipelineUploadProps) {
  const [inputMode, setInputMode] = useState<InputMode>('file')
  const [isDragOver, setIsDragOver] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [pasteContent, setPasteContent] = useState('')
  const [localErrors, setLocalErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setFileName(null)
    setPasteContent('')
    setLocalErrors([])
  }, [])

  const processJsonContent = useCallback(
    async (content: string, sourceName: string) => {
      setIsProcessing(true)
      setLocalErrors([])

      try {
        const result = parsePipelineConfigJson(content)

        if (result.valid && result.config) {
          onValidConfig(result, content)
        } else {
          setLocalErrors(result.errors)
          onError(result.errors)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to process configuration'
        setLocalErrors([errorMsg])
        onError([errorMsg])
      } finally {
        setIsProcessing(false)
      }
    },
    [onValidConfig, onError],
  )

  const handleFileSelect = useCallback(
    async (file: File) => {
      resetState()
      setFileName(file.name)

      // Validate file type
      if (!file.name.endsWith('.json')) {
        const error = 'Please select a JSON file (.json)'
        setLocalErrors([error])
        onError([error])
        return
      }

      // Validate file size
      const sizeValidation = validateFileSize(file)
      if (!sizeValidation.valid) {
        setLocalErrors([sizeValidation.error!])
        onError([sizeValidation.error!])
        return
      }

      try {
        const content = await readFileAsText(file)
        await processJsonContent(content, file.name)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to read file'
        setLocalErrors([errorMsg])
        onError([errorMsg])
      }
    },
    [resetState, processJsonContent, onError],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragOver(true)
      }
    },
    [disabled],
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      if (disabled) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        await handleFileSelect(files[0])
      }
    },
    [disabled, handleFileSelect],
  )

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await handleFileSelect(file)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFileSelect],
  )

  const handlePasteValidate = useCallback(() => {
    if (!pasteContent.trim()) {
      const error = 'Please paste a pipeline configuration'
      setLocalErrors([error])
      onError([error])
      return
    }
    processJsonContent(pasteContent, 'pasted content')
  }, [pasteContent, processJsonContent, onError])

  const handleClearFile = useCallback(() => {
    resetState()
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [resetState])

  return (
    <div className="flex flex-col gap-4">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-[var(--surface-bg)] rounded-lg border border-[var(--surface-border)]">
        <button
          type="button"
          onClick={() => {
            setInputMode('file')
            resetState()
          }}
          disabled={disabled}
          className={cn(
            'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
            inputMode === 'file'
              ? 'bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--option-bg-hover)]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <ArrowUpTrayIcon className="w-4 h-4 inline-block mr-2" />
          Upload File
        </button>
        <button
          type="button"
          onClick={() => {
            setInputMode('paste')
            resetState()
          }}
          disabled={disabled}
          className={cn(
            'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
            inputMode === 'paste'
              ? 'bg-[var(--color-background-primary)] text-[var(--color-on-background-primary)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--option-bg-hover)]',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          <DocumentTextIcon className="w-4 h-4 inline-block mr-2" />
          Paste JSON
        </button>
      </div>

      {/* File Upload Mode */}
      {inputMode === 'file' && (
        <div className="flex flex-col gap-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />

          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            className={cn(
              'relative flex flex-col items-center justify-center gap-3 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-all',
              isDragOver
                ? 'border-[var(--control-border-focus)] bg-[var(--option-bg-hover)]'
                : 'border-[var(--control-border)] bg-[var(--surface-bg)] hover:border-[var(--control-border-hover)] hover:bg-[var(--surface-bg-raised)]',
              disabled && 'opacity-50 cursor-not-allowed',
              isProcessing && 'pointer-events-none',
            )}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-[var(--color-background-primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--text-secondary)]">Processing...</span>
              </div>
            ) : fileName ? (
              <div className="flex flex-col items-center gap-2">
                <DocumentTextIcon className="w-10 h-10 text-[var(--color-foreground-primary)]" />
                <span className="text-sm text-[var(--text-primary)] font-medium">{fileName}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClearFile()
                  }}
                  className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--color-foreground-critical)]"
                >
                  <XMarkIcon className="w-3 h-3" />
                  Clear
                </button>
              </div>
            ) : (
              <>
                <ArrowUpTrayIcon className="w-10 h-10 text-[var(--text-secondary)]" />
                <div className="text-center">
                  <span className="text-sm text-[var(--text-primary)]">
                    Drag and drop your pipeline configuration here
                  </span>
                  <br />
                  <span className="text-xs text-[var(--text-secondary)]">or click to browse</span>
                </div>
                <span className="text-xs text-[var(--text-secondary)]">Accepts .json files up to 1MB</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Paste JSON Mode */}
      {inputMode === 'paste' && (
        <div className="flex flex-col gap-3">
          <Textarea
            value={pasteContent}
            onChange={(e) => {
              setPasteContent(e.target.value)
              setLocalErrors([])
            }}
            placeholder='Paste your pipeline configuration JSON here...\n\n{\n  "name": "my-pipeline",\n  "source": { ... },\n  "sink": { ... }\n}'
            disabled={disabled || isProcessing}
            className="min-h-[200px] font-mono text-sm"
          />
          <Button onClick={handlePasteValidate} disabled={disabled || isProcessing || !pasteContent.trim()} size="sm">
            {isProcessing ? 'Validating...' : 'Validate & Import'}
          </Button>
        </div>
      )}

      {/* Error Display */}
      {localErrors.length > 0 && (
        <div className="p-3 rounded-lg bg-[var(--color-background-critical-faded)] border border-[var(--color-border-critical)]">
          <h4 className="text-sm font-medium text-[var(--color-foreground-critical)] mb-2">Validation Errors</h4>
          <ul className="list-disc list-inside space-y-1">
            {localErrors.map((error, index) => (
              <li key={index} className="text-sm text-[var(--color-foreground-critical-faded)]">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
