import { useState } from 'react'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import {
  readCertificateFile,
  validateCertificateContent,
  getCertificateFileAccept,
} from '@/src/utils/certificate-file-reader'

interface CertificateFileUploadProps {
  onFileRead: (content: string) => void
  disabled?: boolean
  className?: string
}

export function CertificateFileUpload({ onFileRead, disabled, className }: CertificateFileUploadProps) {
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsReading(true)
    setError(null)

    try {
      const result = await readCertificateFile(file)

      // Validate the content
      const validation = validateCertificateContent(result.content)
      if (!validation.valid) {
        setError(validation.error || 'Invalid certificate format')
        setIsReading(false)
        return
      }

      // Call the callback with the file content
      onFileRead(result.content)
      setFileName(result.fileName)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file')
    } finally {
      setIsReading(false)
    }
  }

  const handleClear = () => {
    setFileName(null)
    setError(null)
    onFileRead('')
  }

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept={getCertificateFileAccept()}
          onChange={handleFileChange}
          disabled={disabled || isReading}
          className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
        />
        {fileName && (
          <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
            Clear
          </Button>
        )}
      </div>

      {isReading && <div className="text-sm text-gray-500">Reading file...</div>}

      {fileName && !error && <div className="text-sm text-green-600">Loaded: {fileName}</div>}

      {error && <div className="text-sm text-red-500">{error}</div>}

      <div className="text-xs text-gray-500">Supported formats: PEM, CRT, CER, KEY, P12, PFX, JKS</div>
    </div>
  )
}
