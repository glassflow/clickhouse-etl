/**
 * Utility functions for reading certificate files
 */

export interface CertificateFileReaderResult {
  content: string
  fileName: string
  fileType: string
}

/**
 * Read a certificate file and return its content as a string
 * Supports text-based certificate formats (PEM, CRT, CER)
 */
export const readCertificateFile = (file: File): Promise<CertificateFileReaderResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target?.result as string
      if (!content) {
        reject(new Error('Failed to read file content'))
        return
      }

      resolve({
        content,
        fileName: file.name,
        fileType: file.type || getFileTypeFromExtension(file.name),
      })
    }

    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`))
    }

    // Read as text for PEM-based certificates
    if (isTextBasedCertificate(file.name)) {
      reader.readAsText(file)
    } else {
      // For binary formats, we might need different handling
      // For now, just read as text and let the backend handle it
      reader.readAsText(file)
    }
  })
}

/**
 * Check if the file is a text-based certificate format
 */
const isTextBasedCertificate = (fileName: string): boolean => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const textBasedExtensions = ['pem', 'crt', 'cer', 'key', 'cert']
  return textBasedExtensions.includes(extension || '')
}

/**
 * Get file type from file extension
 */
const getFileTypeFromExtension = (fileName: string): string => {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const typeMap: Record<string, string> = {
    pem: 'application/x-pem-file',
    crt: 'application/x-x509-ca-cert',
    cer: 'application/x-x509-ca-cert',
    key: 'application/x-pem-file',
    cert: 'application/x-x509-ca-cert',
    p12: 'application/x-pkcs12',
    pfx: 'application/x-pkcs12',
    jks: 'application/x-java-keystore',
  }
  return typeMap[extension || ''] || 'application/octet-stream'
}

/**
 * Validate certificate file content
 */
export const validateCertificateContent = (content: string): { valid: boolean; error?: string } => {
  if (!content || content.trim().length === 0) {
    return { valid: false, error: 'Certificate content is empty' }
  }

  // Check for PEM format markers
  const hasPemMarkers =
    content.includes('-----BEGIN CERTIFICATE-----') ||
    content.includes('-----BEGIN RSA PRIVATE KEY-----') ||
    content.includes('-----BEGIN PRIVATE KEY-----') ||
    content.includes('-----BEGIN PUBLIC KEY-----')

  if (!hasPemMarkers) {
    // Could be a binary format or plain text
    // Let's just accept it and let the backend validate
    return { valid: true }
  }

  return { valid: true }
}

/**
 * Supported certificate file extensions
 */
export const SUPPORTED_CERTIFICATE_EXTENSIONS = ['.pem', '.crt', '.cer', '.key', '.cert', '.p12', '.pfx', '.jks']

/**
 * Get accept attribute value for file input
 */
export const getCertificateFileAccept = (): string => {
  return SUPPORTED_CERTIFICATE_EXTENSIONS.join(',')
}
