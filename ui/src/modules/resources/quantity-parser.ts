/**
 * Client-side parsers for Kubernetes resource quantities and related formats.
 * Mirrors backend validation: resource.ParseQuantity, ParseNATSMaxBytesQuantity, time.ParseDuration.
 *
 * Kubernetes quantity format:
 * - Number: optional +/-, digits, optional . + fractional digits
 * - Suffix: binary (Ki, Mi, Gi, Ti, Pi, Ei) OR decimal (m, k, M, G, T, P, E) OR exponent (e/E + number) OR empty
 * - Note: 1GB is invalid for regular quantities (use 1G or 1Gi); 100GB is only valid for NATS maxBytes
 */

/** User-facing format hints and validation error messages (same text). */
export const HINT_K8S_QUANTITY = 'Use Kubernetes format, e.g. 100m, 1Gi, 128Mi'
export const HINT_NATS_MAX_BYTES = 'Use format like 10Gi, 100GB, or 1TB'
export const HINT_NATS_MAX_AGE = 'Use duration format, e.g. 24h, 1m, 30s'
export const HINT_REPLICAS = 'Positive integer, e.g. 1'

const K8S_QUANTITY_ERROR = HINT_K8S_QUANTITY
const NATS_MAX_BYTES_ERROR = HINT_NATS_MAX_BYTES
const NATS_MAX_AGE_ERROR = HINT_NATS_MAX_AGE

/** Binary SI suffixes (powers of 1024) */
const BINARY_SUFFIXES = ['Ki', 'Mi', 'Gi', 'Ti', 'Pi', 'Ei'] as const

/** Decimal SI suffixes (powers of 1000): m, k, M, G, T, P, E */
const DECIMAL_SUFFIXES = ['m', 'k', 'M', 'G', 'T', 'P', 'E'] as const

/** Human byte suffixes (NATS maxBytes compatibility): KB, MB, GB, TB */
const HUMAN_BYTE_SUFFIXES = ['KB', 'MB', 'GB', 'TB'] as const

/** Go duration units: h, m, s, ms, us, ns (and µs); number may be fractional */
const DURATION_UNIT_PATTERN = /^(-?\d+\.?\d*|-?\d*\.\d+)(ns|us|µs|ms|s|m|h)(.*)$/

export type ValidationResult = { valid: true } | { valid: false; error: string }

function trimValue(val: string): string {
  return val.trim()
}

/**
 * Validates a Kubernetes resource quantity (CPU, memory, storage).
 * Accepts: 100m, 1, 128Mi, 1.5Gi, 1e3, 1048576, etc.
 * Rejects: 1GB (use 1G or 1Gi), 10gigs, abc, etc.
 */
export function validateKubernetesQuantity(value: string): ValidationResult {
  const s = trimValue(value)
  if (s === '') return { valid: true }

  // Split number and suffix using Kubernetes-style parsing
  const match = s.match(/^([+-]?\d+\.?\d*|\d*\.\d+)(.*)$/)
  if (!match) return { valid: false, error: K8S_QUANTITY_ERROR }

  const numPart = match[1]
  const suffix = match[2]

  // Validate number part (at least one digit)
  if (!/^[+-]?(\d+\.?\d*|\d*\.\d+)$/.test(numPart) || numPart === '' || numPart === '.' || numPart === '-.' || numPart === '+.') {
    return { valid: false, error: K8S_QUANTITY_ERROR }
  }

  // Max 3 decimal places (Kubernetes constraint)
  const decimalMatch = numPart.match(/\.(\d+)/)
  if (decimalMatch && decimalMatch[1].length > 3) {
    return { valid: false, error: K8S_QUANTITY_ERROR }
  }

  // No suffix: plain integer - valid
  if (suffix === '') return { valid: true }

  // Binary SI
  for (const suf of BINARY_SUFFIXES) {
    if (suffix === suf) return { valid: true }
  }

  // Decimal SI (single char)
  for (const suf of DECIMAL_SUFFIXES) {
    if (suffix === suf) return { valid: true }
  }

  // Decimal exponent: e or E followed by optional +/-, then digits
  if (/^[eE][+-]?\d+$/.test(suffix)) return { valid: true }

  return { valid: false, error: K8S_QUANTITY_ERROR }
}

/**
 * Validates NATS maxBytes: Kubernetes quantity OR human format (KB, MB, GB, TB).
 */
export function validateNatsMaxBytes(value: string): ValidationResult {
  const s = trimValue(value)
  if (s === '') return { valid: true }

  // Try Kubernetes quantity first
  const k8s = validateKubernetesQuantity(s)
  if (k8s.valid) return k8s

  // Try human byte format (100GB, 1.5TB, etc.)
  const upper = s.toUpperCase()
  for (const suf of HUMAN_BYTE_SUFFIXES) {
    if (upper.endsWith(suf)) {
      const numStr = upper.slice(0, -suf.length).trim()
      const num = parseFloat(numStr)
      if (numStr !== '' && !Number.isNaN(num) && isFinite(num) && num >= 0) {
        return { valid: true }
      }
      break
    }
  }

  return { valid: false, error: NATS_MAX_BYTES_ERROR }
}

/**
 * Validates Go duration format: 24h, 1m, 30s, 1h30m, -1h, etc.
 * Units: ns, us, µs, ms, s, m, h
 */
export function validateNatsMaxAge(value: string): ValidationResult {
  const s = trimValue(value)
  if (s === '') return { valid: true }

  let rest = s
  let hadUnit = false

  while (rest.length > 0) {
    const match = rest.match(DURATION_UNIT_PATTERN)
    if (!match) {
      // Must have at least one unit
      if (!hadUnit) return { valid: false, error: NATS_MAX_AGE_ERROR }
      // Trailing non-numeric junk
      if (/^\s*$/.test(rest)) return { valid: true }
      return { valid: false, error: NATS_MAX_AGE_ERROR }
    }
    hadUnit = true
    rest = match[3].trim()
  }

  return { valid: true }
}
