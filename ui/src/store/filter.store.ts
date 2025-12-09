import { StateCreator } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  createInitialValidation,
  createValidValidation,
  createInvalidatedValidation,
  ValidationState,
  ValidationMethods,
} from '@/src/types/validation'

// Filter operator types based on expr-lang supported operations
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'notIn' | 'isNull' | 'isNotNull'
// Future: Reserved for stateless transformations
// | 'contains' | 'startsWith' | 'endsWith'

// Logic operator for combining rules/groups
export type LogicOperator = 'and' | 'or'

// Arithmetic operator types
export type ArithmeticOperator = '+' | '-' | '*' | '/' | '%'

// Arithmetic operand - either a field reference or a literal number
export interface ArithmeticFieldOperand {
  type: 'field'
  field: string // Field name from schema
  fieldType: string // Field type from schema
}

export interface ArithmeticLiteralOperand {
  type: 'literal'
  value: number
}

export type ArithmeticOperand = ArithmeticFieldOperand | ArithmeticLiteralOperand

// Arithmetic expression - a binary tree of operands and operators
export interface ArithmeticExpressionNode {
  id: string
  left: ArithmeticOperand | ArithmeticExpressionNode
  operator: ArithmeticOperator
  right: ArithmeticOperand | ArithmeticExpressionNode
}

// Helper type to check if something is an expression node
export const isArithmeticExpressionNode = (
  node: ArithmeticOperand | ArithmeticExpressionNode,
): node is ArithmeticExpressionNode => {
  return 'operator' in node && 'left' in node && 'right' in node
}

// Maximum nesting depth for groups (3 levels: root + 2 sub-levels)
export const MAX_GROUP_DEPTH = 3

// A single filter rule in the query builder
export interface FilterRule {
  id: string
  type: 'rule'
  // Simple mode: single field
  field: string // Field name from schema
  fieldType: string // Field type from schema (string, int, float64, bool, etc.)
  // Expression mode: arithmetic expression on left side
  useArithmeticExpression?: boolean // Toggle between simple field and arithmetic expression
  arithmeticExpression?: ArithmeticExpressionNode // Arithmetic expression (e.g., price + discount)
  // Comparison
  operator: FilterOperator
  value: string | number | boolean
  not?: boolean // NOT for individual rules
}

// A group of rules/groups with a combinator
export interface FilterGroup {
  id: string
  type: 'group'
  combinator: LogicOperator
  not?: boolean // NOT for entire group
  children: (FilterRule | FilterGroup)[]
}

// Union type for any query builder item
export type FilterItem = FilterRule | FilterGroup

// Legacy filter condition (for backward compatibility)
export interface FilterCondition {
  id: string
  field: string
  fieldType: string
  operator: FilterOperator
  value: string | number | boolean
}

// Filter configuration state
export interface FilterConfig {
  enabled: boolean
  root: FilterGroup // Root group containing all rules/groups
  // Legacy fields for backward compatibility
  combinator?: 'and' | 'or'
  conditions?: FilterCondition[]
}

export interface FilterStoreProps {
  filterConfig: FilterConfig
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

export interface FilterStore extends FilterStoreProps, ValidationMethods {
  // Actions
  setFilterEnabled: (enabled: boolean) => void

  // New recursive actions
  addRule: (parentGroupId: string) => void
  addGroup: (parentGroupId: string) => void
  updateRule: (ruleId: string, updates: Partial<Omit<FilterRule, 'id' | 'type'>>) => void
  updateGroup: (groupId: string, updates: Partial<Pick<FilterGroup, 'combinator' | 'not'>>) => void
  removeItem: (itemId: string) => void

  // Legacy actions (for backward compatibility)
  setCombinator: (combinator: 'and' | 'or') => void
  addCondition: (condition: FilterCondition) => void
  updateCondition: (id: string, condition: Partial<FilterCondition>) => void
  removeCondition: (id: string) => void
  clearConditions: () => void

  // Common actions
  setExpressionString: (expression: string) => void
  setBackendValidation: (status: FilterStoreProps['backendValidation']) => void
  getFilterConfig: () => FilterConfig
  skipFilter: () => void
  resetFilterStore: () => void
}

export interface FilterSlice {
  filterStore: FilterStore
}

// Helper to create an empty root group
const createEmptyRootGroup = (): FilterGroup => ({
  id: uuidv4(),
  type: 'group',
  combinator: 'and',
  not: false,
  children: [],
})

// Helper to create an empty rule
export const createEmptyRule = (): FilterRule => ({
  id: uuidv4(),
  type: 'rule',
  field: '',
  fieldType: '',
  useArithmeticExpression: false,
  arithmeticExpression: undefined,
  operator: 'eq',
  value: '',
  not: false,
})

// Helper to create an empty arithmetic expression
export const createEmptyArithmeticExpression = (): ArithmeticExpressionNode => ({
  id: uuidv4(),
  left: { type: 'field', field: '', fieldType: '' },
  operator: '+',
  right: { type: 'literal', value: 0 },
})

// Helper to create a field operand
export const createFieldOperand = (field: string, fieldType: string): ArithmeticFieldOperand => ({
  type: 'field',
  field,
  fieldType,
})

// Helper to create a literal operand
export const createLiteralOperand = (value: number): ArithmeticLiteralOperand => ({
  type: 'literal',
  value,
})

// Helper to create an empty group
export const createEmptyGroup = (): FilterGroup => ({
  id: uuidv4(),
  type: 'group',
  combinator: 'and',
  not: false,
  children: [],
})

// Helper to find an item by ID in the tree
const findItemById = (root: FilterGroup, itemId: string): FilterItem | null => {
  if (root.id === itemId) return root

  for (const child of root.children) {
    if (child.id === itemId) return child
    if (child.type === 'group') {
      const found = findItemById(child, itemId)
      if (found) return found
    }
  }
  return null
}

// Helper to find parent group of an item
const findParentGroup = (root: FilterGroup, itemId: string): FilterGroup | null => {
  for (const child of root.children) {
    if (child.id === itemId) return root
    if (child.type === 'group') {
      const found = findParentGroup(child, itemId)
      if (found) return found
    }
  }
  return null
}

// Helper to get depth of a group in the tree
const getGroupDepth = (root: FilterGroup, groupId: string, currentDepth = 0): number => {
  if (root.id === groupId) return currentDepth

  for (const child of root.children) {
    if (child.type === 'group') {
      const depth = getGroupDepth(child, groupId, currentDepth + 1)
      if (depth >= 0) return depth
    }
  }
  return -1
}

// Helper to add item to a group
const addItemToGroup = (root: FilterGroup, parentGroupId: string, item: FilterItem): FilterGroup => {
  if (root.id === parentGroupId) {
    return {
      ...root,
      children: [...root.children, item],
    }
  }

  return {
    ...root,
    children: root.children.map((child) => {
      if (child.type === 'group') {
        return addItemToGroup(child, parentGroupId, item)
      }
      return child
    }),
  }
}

// Helper to update a rule in the tree
const updateRuleInTree = (
  root: FilterGroup,
  ruleId: string,
  updates: Partial<Omit<FilterRule, 'id' | 'type'>>,
): FilterGroup => {
  return {
    ...root,
    children: root.children.map((child) => {
      if (child.type === 'rule' && child.id === ruleId) {
        return { ...child, ...updates }
      }
      if (child.type === 'group') {
        return updateRuleInTree(child, ruleId, updates)
      }
      return child
    }),
  }
}

// Helper to update a group in the tree
const updateGroupInTree = (
  root: FilterGroup,
  groupId: string,
  updates: Partial<Pick<FilterGroup, 'combinator' | 'not'>>,
): FilterGroup => {
  if (root.id === groupId) {
    return { ...root, ...updates }
  }

  return {
    ...root,
    children: root.children.map((child) => {
      if (child.type === 'group') {
        if (child.id === groupId) {
          return { ...child, ...updates }
        }
        return updateGroupInTree(child, groupId, updates)
      }
      return child
    }),
  }
}

// Helper to remove an item from the tree
const removeItemFromTree = (root: FilterGroup, itemId: string): FilterGroup => {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== itemId)
      .map((child) => {
        if (child.type === 'group') {
          return removeItemFromTree(child, itemId)
        }
        return child
      }),
  }
}

// Helper to count total rules in the tree
const countRules = (group: FilterGroup): number => {
  let count = 0
  for (const child of group.children) {
    if (child.type === 'rule') {
      count++
    } else {
      count += countRules(child)
    }
  }
  return count
}

// Helper to check if tree has any rules
const hasRules = (group: FilterGroup): boolean => {
  return countRules(group) > 0
}

// Migrate legacy flat conditions to new tree structure
export const migrateToTreeStructure = (config: FilterConfig): FilterConfig => {
  // If already has root, return as is
  if (config.root) {
    return config
  }

  // Migrate from legacy flat structure
  const legacyConditions = config.conditions || []
  const legacyCombinator = config.combinator || 'and'

  const root: FilterGroup = {
    id: uuidv4(),
    type: 'group',
    combinator: legacyCombinator,
    not: false,
    children: legacyConditions.map(
      (c): FilterRule => ({
        id: c.id,
        type: 'rule',
        field: c.field,
        fieldType: c.fieldType,
        operator: c.operator,
        value: c.value,
        not: false,
      }),
    ),
  }

  return {
    enabled: config.enabled,
    root,
  }
}

const initialFilterConfig: FilterConfig = {
  enabled: false,
  root: createEmptyRootGroup(),
}

const initialBackendValidation: FilterStoreProps['backendValidation'] = {
  status: 'idle',
}

export const createFilterSlice: StateCreator<FilterSlice> = (set, get) => ({
  filterStore: {
    // State
    filterConfig: { ...initialFilterConfig },
    expressionString: '',
    backendValidation: { ...initialBackendValidation },
    validation: createInitialValidation(),

    // Actions
    setFilterEnabled: (enabled: boolean) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            enabled,
          },
        },
      })),

    // Add a new rule to a group
    addRule: (parentGroupId: string) =>
      set((state) => {
        const newRule = createEmptyRule()
        const newRoot = addItemToGroup(state.filterStore.filterConfig.root, parentGroupId, newRule)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              enabled: true,
              root: newRoot,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Add a new group to a parent group (with depth check)
    addGroup: (parentGroupId: string) =>
      set((state) => {
        const currentDepth = getGroupDepth(state.filterStore.filterConfig.root, parentGroupId)

        // Check if we've reached max depth
        if (currentDepth >= MAX_GROUP_DEPTH - 1) {
          console.warn('Maximum group nesting depth reached')
          return state
        }

        const newGroup = createEmptyGroup()
        const newRoot = addItemToGroup(state.filterStore.filterConfig.root, parentGroupId, newGroup)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              enabled: true,
              root: newRoot,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Update a rule
    updateRule: (ruleId: string, updates: Partial<Omit<FilterRule, 'id' | 'type'>>) =>
      set((state) => {
        const newRoot = updateRuleInTree(state.filterStore.filterConfig.root, ruleId, updates)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              root: newRoot,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Update a group
    updateGroup: (groupId: string, updates: Partial<Pick<FilterGroup, 'combinator' | 'not'>>) =>
      set((state) => {
        const newRoot = updateGroupInTree(state.filterStore.filterConfig.root, groupId, updates)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              root: newRoot,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Remove an item (rule or group)
    removeItem: (itemId: string) =>
      set((state) => {
        // Don't allow removing the root group
        if (state.filterStore.filterConfig.root.id === itemId) {
          console.warn('Cannot remove root group')
          return state
        }

        const newRoot = removeItemFromTree(state.filterStore.filterConfig.root, itemId)
        const stillHasRules = hasRules(newRoot)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              root: newRoot,
              enabled: stillHasRules,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Legacy: Set combinator on root group
    setCombinator: (combinator: 'and' | 'or') =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            root: {
              ...state.filterStore.filterConfig.root,
              combinator,
            },
          },
        },
      })),

    // Legacy: Add condition as rule to root group
    addCondition: (condition: FilterCondition) =>
      set((state) => {
        const newRule: FilterRule = {
          id: condition.id,
          type: 'rule',
          field: condition.field,
          fieldType: condition.fieldType,
          operator: condition.operator,
          value: condition.value,
          not: false,
        }

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              enabled: true,
              root: {
                ...state.filterStore.filterConfig.root,
                children: [...state.filterStore.filterConfig.root.children, newRule],
              },
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Legacy: Update condition (rule)
    updateCondition: (id: string, updates: Partial<FilterCondition>) =>
      set((state) => {
        const ruleUpdates: Partial<Omit<FilterRule, 'id' | 'type'>> = {}
        if (updates.field !== undefined) ruleUpdates.field = updates.field
        if (updates.fieldType !== undefined) ruleUpdates.fieldType = updates.fieldType
        if (updates.operator !== undefined) ruleUpdates.operator = updates.operator
        if (updates.value !== undefined) ruleUpdates.value = updates.value

        const newRoot = updateRuleInTree(state.filterStore.filterConfig.root, id, ruleUpdates)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              root: newRoot,
            },
            validation: createValidValidation(),
          },
        }
      }),

    // Legacy: Remove condition
    removeCondition: (id: string) =>
      set((state) => {
        const newRoot = removeItemFromTree(state.filterStore.filterConfig.root, id)
        const stillHasRules = hasRules(newRoot)

        return {
          filterStore: {
            ...state.filterStore,
            filterConfig: {
              ...state.filterStore.filterConfig,
              root: newRoot,
              enabled: stillHasRules,
            },
            validation: createValidValidation(),
          },
        }
      }),

    clearConditions: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            ...state.filterStore.filterConfig,
            root: createEmptyRootGroup(),
            enabled: false,
          },
          expressionString: '',
          backendValidation: { status: 'idle' },
        },
      })),

    setExpressionString: (expression: string) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          expressionString: expression,
        },
      })),

    setBackendValidation: (backendValidation: FilterStoreProps['backendValidation']) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          backendValidation,
        },
      })),

    getFilterConfig: () => get().filterStore.filterConfig,

    skipFilter: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            enabled: false,
            root: createEmptyRootGroup(),
          },
          expressionString: '',
          backendValidation: { status: 'idle' },
          validation: createValidValidation(),
        },
      })),

    resetFilterStore: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          filterConfig: {
            enabled: false,
            root: createEmptyRootGroup(),
          },
          expressionString: '',
          backendValidation: { ...initialBackendValidation },
          validation: createInitialValidation(),
        },
      })),

    // Validation methods
    markAsValid: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createValidValidation(),
        },
      })),

    markAsInvalidated: (invalidatedBy: string) =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInvalidatedValidation(invalidatedBy),
        },
      })),

    markAsNotConfigured: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInitialValidation(),
        },
      })),

    resetValidation: () =>
      set((state) => ({
        filterStore: {
          ...state.filterStore,
          validation: createInitialValidation(),
        },
      })),
  },
})
