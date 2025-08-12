// Base validation types for store slices
export interface ValidationState {
  status: 'not-configured' | 'valid' | 'invalidated'
  invalidatedBy?: string
  lastModified?: Date
}

// Helper to create initial validation state
export const createInitialValidation = (): ValidationState => ({
  status: 'not-configured',
})

// Helper to create valid validation state
export const createValidValidation = (): ValidationState => ({
  status: 'valid',
  lastModified: new Date(),
})

// Helper to create invalidated validation state
export const createInvalidatedValidation = (invalidatedBy: string): ValidationState => ({
  status: 'invalidated',
  invalidatedBy,
  lastModified: new Date(),
})

// Base interface for validation methods that all stores should implement
export interface ValidationMethods {
  markAsValid: () => void
  markAsInvalidated: (invalidatedBy: string) => void
  markAsNotConfigured: () => void
  resetValidation: () => void
}
