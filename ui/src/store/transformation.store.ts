import { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

// Function argument types
export interface FunctionArgField {
  type: 'field'
  fieldName: string
  fieldType: string
}

export interface FunctionArgLiteral {
  type: 'literal'
  value: string | number | boolean
  literalType: 'string' | 'number' | 'boolean'
}

export interface FunctionArgArray {
  type: 'array'
  values: (string | number | FunctionArg)[]
  elementType: 'string' | 'number' | 'nested_function'
}

// Waterfall expression slot - each element in a waterfall array
export type WaterfallSlotType = 'field' | 'function' | 'literal'

export interface WaterfallSlot {
  id: string
  slotType: WaterfallSlotType
  // For field type
  fieldName?: string
  fieldType?: string
  // For function type (simple function, not nested chains)
  functionName?: string
  functionArgs?: FunctionArg[]
  // For literal type
  literalValue?: string
  literalType?: 'string' | 'number'
}

// Waterfall-specific array argument
export interface FunctionArgWaterfallArray {
  type: 'waterfall_array'
  slots: WaterfallSlot[]
}

// Concat expression slot - each element in a concat array (simpler than waterfall)
export type ConcatSlotType = 'field' | 'literal'

export interface ConcatSlot {
  id: string
  slotType: ConcatSlotType
  // For field type
  fieldName?: string
  fieldType?: string
  // For literal type
  literalValue?: string
}

// Post-process function for concat - applies to the concat result
export interface PostProcessFunction {
  id: string
  functionName: string
  // Additional arguments beyond the piped input (the concat result)
  additionalArgs: FunctionArg[]
}

// Concat-specific array argument
export interface FunctionArgConcatArray {
  type: 'concat_array'
  slots: ConcatSlot[]
  // Optional chain of functions to apply to concat result
  // e.g., toUpper(trim(concat(...))) would have [trim, toUpper] in the chain
  postProcessChain?: PostProcessFunction[]
}

// New: A function argument can itself be a nested function call
export interface FunctionArgNestedFunction {
  type: 'nested_function'
  functionName: string
  functionArgs: FunctionArg[]
}

export type FunctionArg =
  | FunctionArgField
  | FunctionArgLiteral
  | FunctionArgArray
  | FunctionArgNestedFunction
  | FunctionArgWaterfallArray
  | FunctionArgConcatArray

// Expression mode for computed fields
export type ExpressionMode = 'simple' | 'nested' | 'raw'

// Arithmetic operator types for transformations
export type TransformArithmeticOperator = '+' | '-' | '*' | '/' | '%'

// Arithmetic expression to apply on top of function result
export interface TransformArithmeticExpression {
  operator: TransformArithmeticOperator
  operand: number // Right-hand operand (e.g., 1000000 in "* 1000000")
}

// A transformation field - either computed or passthrough
export interface TransformationField {
  id: string
  type: 'computed' | 'passthrough'
  outputFieldName: string // Name in intermediary schema
  outputFieldType: string // Inferred from function or source field
  // For computed fields:
  functionName?: string // e.g., 'parseQuery', 'toInt'
  functionArgs?: FunctionArg[] // Source fields or literals
  // For passthrough:
  sourceField?: string // Original Kafka field name
  sourceFieldType?: string // Type of the source field
  // Expression mode for computed fields (simple, nested, or raw)
  expressionMode?: ExpressionMode
  // Raw expression for complex cases (ternary, comparisons, etc.)
  rawExpression?: string
  // Arithmetic expression to apply on function result (e.g., * 1000000)
  arithmeticExpression?: TransformArithmeticExpression
}

// Transformation configuration state
export interface TransformationConfig {
  enabled: boolean
  fields: TransformationField[]
}

export interface TransformationStoreProps {
  transformationConfig: TransformationConfig
  // Generated expression string (for display and backend)
  expressionString: string
  // Backend validation state
  backendValidation: {
    status: 'idle' | 'validating' | 'valid' | 'invalid'
    error?: string
  }
  // Validation state
  validation: ValidationState
}

export interface TransformationStore extends TransformationStoreProps, ValidationMethods {
  // Actions
  setTransformationEnabled: (enabled: boolean) => void

  // Field management actions
  addField: (field?: Partial<TransformationField>) => void
  addPassthroughField: (sourceField: string, sourceFieldType: string, outputFieldName?: string) => void
  addComputedField: (
    functionName: string,
    functionArgs: FunctionArg[],
    outputFieldName: string,
    outputFieldType: string,
  ) => void
  updateField: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) => void
  removeField: (fieldId: string) => void
  reorderFields: (fromIndex: number, toIndex: number) => void
  clearFields: () => void

  // Bulk operations
  addAllFieldsAsPassthrough: (fields: Array<{ name: string; type: string }>) => void

  // Common actions
  setExpressionString: (expression: string) => void
  setBackendValidation: (status: TransformationStoreProps['backendValidation']) => void
  getTransformationConfig: () => TransformationConfig
  setTransformationConfig: (config: TransformationConfig) => void
  skipTransformation: () => void
  resetTransformationStore: () => void

  // Computed getters
  getIntermediarySchema: () => Array<{ name: string; type: string }>
  hasFields: () => boolean
  getFieldCount: () => number
}

export interface TransformationSlice {
  transformationStore: TransformationStore
}

// Helper to create an empty passthrough field
export const createEmptyPassthroughField = (): TransformationField => ({
  id: uuidv4(),
  type: 'passthrough',
  outputFieldName: '',
  outputFieldType: '',
  sourceField: '',
  sourceFieldType: '',
})

// Helper to create an empty computed field
export const createEmptyComputedField = (expressionMode: ExpressionMode = 'simple'): TransformationField => ({
  id: uuidv4(),
  type: 'computed',
  outputFieldName: '',
  outputFieldType: '',
  functionName: '',
  functionArgs: [],
  expressionMode,
  rawExpression: '',
})

// Helper to create a passthrough field from source
export const createPassthroughField = (
  sourceField: string,
  sourceFieldType: string,
  outputFieldName?: string,
): TransformationField => ({
  id: uuidv4(),
  type: 'passthrough',
  outputFieldName: outputFieldName || sourceField,
  outputFieldType: sourceFieldType,
  sourceField,
  sourceFieldType,
})

// Helper to create a computed field
export const createComputedField = (
  functionName: string,
  functionArgs: FunctionArg[],
  outputFieldName: string,
  outputFieldType: string,
): TransformationField => ({
  id: uuidv4(),
  type: 'computed',
  outputFieldName,
  outputFieldType,
  functionName,
  functionArgs,
})

// Helper to check if a field is complete
export const isFieldComplete = (field: TransformationField): boolean => {
  if (!field.outputFieldName) return false

  if (field.type === 'passthrough') {
    // sourceFieldType can default to 'string' if not explicitly set
    return !!field.sourceField
  }

  if (field.type === 'computed') {
    // Raw expression mode - just needs the expression
    if (field.expressionMode === 'raw') {
      return !!field.rawExpression && field.rawExpression.trim().length > 0
    }
    // Simple or nested mode - needs function name and args
    return !!field.functionName && (field.functionArgs?.length ?? 0) > 0
  }

  return false
}

// Helper to check if a function argument is a nested function
export const isNestedFunctionArg = (arg: FunctionArg): arg is FunctionArgNestedFunction => {
  return arg.type === 'nested_function'
}

// Helper to check if a nested function argument is complete
export const isNestedFunctionComplete = (arg: FunctionArgNestedFunction): boolean => {
  if (!arg.functionName) return false
  // Recursively check nested args
  for (const nestedArg of arg.functionArgs) {
    if (nestedArg.type === 'nested_function') {
      if (!isNestedFunctionComplete(nestedArg)) return false
    } else if (nestedArg.type === 'field') {
      if (!nestedArg.fieldName) return false
    }
    // Literals and arrays are always considered complete if they exist
  }
  return true
}

// Helper to count complete fields
export const countCompleteFields = (fields: TransformationField[]): number => {
  return fields.filter(isFieldComplete).length
}

const initialTransformationConfig: TransformationConfig = {
  enabled: false,
  fields: [],
}

const initialBackendValidation: TransformationStoreProps['backendValidation'] = {
  status: 'idle',
}

export const createTransformationSlice: StateCreator<TransformationSlice> = (set, get) => ({
  transformationStore: {
    // State
    transformationConfig: { ...initialTransformationConfig },
    expressionString: '',
    backendValidation: { ...initialBackendValidation },
    validation: createInitialValidation(),

    // Actions
    setTransformationEnabled: (enabled: boolean) =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          transformationConfig: {
            ...state.transformationStore.transformationConfig,
            enabled,
          },
        },
      })),

    // Add a new field (defaults to passthrough)
    addField: (field?: Partial<TransformationField>) =>
      set((state) => {
        const newField: TransformationField = {
          id: uuidv4(),
          type: field?.type || 'passthrough',
          outputFieldName: field?.outputFieldName || '',
          outputFieldType: field?.outputFieldType || '',
          sourceField: field?.sourceField,
          sourceFieldType: field?.sourceFieldType,
          functionName: field?.functionName,
          functionArgs: field?.functionArgs,
          expressionMode: field?.expressionMode || 'simple',
          rawExpression: field?.rawExpression,
          arithmeticExpression: field?.arithmeticExpression,
        }

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              enabled: true,
              fields: [...state.transformationStore.transformationConfig.fields, newField],
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Add a passthrough field
    addPassthroughField: (sourceField: string, sourceFieldType: string, outputFieldName?: string) =>
      set((state) => {
        const newField = createPassthroughField(sourceField, sourceFieldType, outputFieldName)

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              enabled: true,
              fields: [...state.transformationStore.transformationConfig.fields, newField],
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Add a computed field
    addComputedField: (
      functionName: string,
      functionArgs: FunctionArg[],
      outputFieldName: string,
      outputFieldType: string,
    ) =>
      set((state) => {
        const newField = createComputedField(functionName, functionArgs, outputFieldName, outputFieldType)

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              enabled: true,
              fields: [...state.transformationStore.transformationConfig.fields, newField],
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Update a field
    updateField: (fieldId: string, updates: Partial<Omit<TransformationField, 'id'>>) =>
      set((state) => {
        const updatedFields = state.transformationStore.transformationConfig.fields.map((field) => {
          if (field.id === fieldId) {
            return { ...field, ...updates }
          }
          return field
        })

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              fields: updatedFields,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Remove a field
    removeField: (fieldId: string) =>
      set((state) => {
        const updatedFields = state.transformationStore.transformationConfig.fields.filter(
          (field) => field.id !== fieldId,
        )
        const stillHasFields = updatedFields.length > 0

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              fields: updatedFields,
              enabled: stillHasFields,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Reorder fields (for drag-and-drop)
    reorderFields: (fromIndex: number, toIndex: number) =>
      set((state) => {
        const fields = [...state.transformationStore.transformationConfig.fields]
        const [movedField] = fields.splice(fromIndex, 1)
        fields.splice(toIndex, 0, movedField)

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              fields,
            },
          },
        }
      }),

    // Clear all fields
    clearFields: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          transformationConfig: {
            ...state.transformationStore.transformationConfig,
            fields: [],
            enabled: false,
          },
          expressionString: '',
          backendValidation: { status: 'idle' },
        },
      })),

    // Add all source fields as passthrough fields (replaces existing fields)
    addAllFieldsAsPassthrough: (fields: Array<{ name: string; type: string }>) =>
      set((state) => {
        const passthroughFields = fields.map((f) => createPassthroughField(f.name, f.type))

        return {
          transformationStore: {
            ...state.transformationStore,
            transformationConfig: {
              ...state.transformationStore.transformationConfig,
              enabled: true,
              fields: passthroughFields,
            },
            validation: createValidValidation(),
          },
        }
      }),

    setExpressionString: (expression: string) =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          expressionString: expression,
        },
      })),

    setBackendValidation: (backendValidation: TransformationStoreProps['backendValidation']) =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          backendValidation,
        },
      })),

    getTransformationConfig: () => get().transformationStore.transformationConfig,

    setTransformationConfig: (config: TransformationConfig) =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          transformationConfig: config,
        },
      })),

    skipTransformation: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          transformationConfig: {
            enabled: false,
            fields: [],
          },
          expressionString: '',
          backendValidation: { status: 'idle' },
          validation: createValidValidation(),
        },
      })),

    resetTransformationStore: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          transformationConfig: {
            enabled: false,
            fields: [],
          },
          expressionString: '',
          backendValidation: { ...initialBackendValidation },
          validation: createInitialValidation(),
        },
      })),

    // Get the intermediary schema from transformation fields
    getIntermediarySchema: () => {
      const { fields, enabled } = get().transformationStore.transformationConfig
      if (!enabled || fields.length === 0) {
        return []
      }
      return fields.filter(isFieldComplete).map((field) => ({
        name: field.outputFieldName,
        type: field.outputFieldType,
      }))
    },

    // Check if transformation has any fields
    hasFields: () => {
      return get().transformationStore.transformationConfig.fields.length > 0
    },

    // Get the number of fields
    getFieldCount: () => {
      return get().transformationStore.transformationConfig.fields.length
    },

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        transformationStore: {
          ...state.transformationStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
