import { InputFile } from './InputFile'
import { validateCertificateContent, SUPPORTED_CERTIFICATE_EXTENSIONS } from '@/src/utils/certificate-file-reader'

interface CertificateFileUploadProps {
  onFileRead: (content: string, fileName: string) => void
  disabled?: boolean
  className?: string
  externalError?: string
  initialFileName?: string
  value?: string
}

/**
 * CertificateFileUpload component - a specialized wrapper around InputFile
 * for handling certificate file uploads with validation
 *
 * Note: Certificate files often come without extensions (e.g., 'ca-cert', 'server-cert')
 * so we don't restrict file types at the browser level. Validation is done on content.
 */
export function CertificateFileUpload({
  onFileRead,
  disabled,
  className,
  externalError,
  initialFileName,
  value,
}: CertificateFileUploadProps) {
  const handleFileChange = (content: string, fileName: string) => {
    onFileRead(content, fileName)
  }

  // Don't restrict file types - certificates often have no extension
  // Pass empty array to InputFile to accept all files
  // Validation happens via validateCertificateContent based on file content, not extension
  const allowedTypes: string[] = []

  return (
    <InputFile
      id="certificate-upload"
      placeholder="Select certificate file"
      allowedFileTypes={allowedTypes}
      onChange={handleFileChange}
      value={value}
      initialFileName={initialFileName}
      readType="text"
      disabled={disabled}
      className={className}
      showClearButton={true}
      showLoadingState={true}
      showErrorState={true}
      onValidate={(content) => validateCertificateContent(content)}
      hintText="All file types accepted (PEM, CRT, CER, KEY, or files without extensions like ca-cert)"
      externalError={externalError}
    />
  )
}
