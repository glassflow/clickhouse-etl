/**
 * Expression Parser for Expr Language
 *
 * Parses Expr expression strings from the backend into FilterGroup/FilterRule
 * tree structures that can be used by the Query Builder UI.
 *
 * Uses @exprlang/parser (Lezer-based) to parse expressions into a CST,
 * then transforms the CST into the filter store's data structures.
 */

import { parser } from '@exprlang/parser'
import type { SyntaxNode, TreeCursor } from '@lezer/common'
import { v4 as uuidv4 } from 'uuid'
import type {
  FilterGroup,
  FilterRule,
  FilterOperator,
  LogicOperator,
  ArithmeticExpressionNode,
  ArithmeticOperand,
  ArithmeticOperator,
  ArithmeticFunctionCallOperand,
} from '@/src/store/filter.store'

// =============================================================================
// Types
// =============================================================================

/**
 * Result of parsing an expression
 */
export interface ParseResult {
  /** Whether parsing was successful */
  success: boolean
  /** The reconstructed filter tree (if successful) */
  filterGroup?: FilterGroup
  /** Error message (if parsing failed) */
  error?: string
  /** List of unsupported features encountered */
  unsupportedFeatures?: string[]
}

/**
 * Internal intermediate AST node types
 */
type ASTNode = ASTBinaryExpr | ASTUnaryExpr | ASTIdentifier | ASTLiteral | ASTArray | ASTParenthesized | ASTFunctionCall

interface ASTBinaryExpr {
  type: 'BinaryExpr'
  operator: string
  left: ASTNode
  right: ASTNode
}

interface ASTUnaryExpr {
  type: 'UnaryExpr'
  operator: string
  operand: ASTNode
}

interface ASTIdentifier {
  type: 'Identifier'
  name: string
}

interface ASTLiteral {
  type: 'Literal'
  value: string | number | boolean | null
  literalType: 'string' | 'number' | 'boolean' | 'nil'
}

interface ASTArray {
  type: 'Array'
  elements: ASTNode[]
}

interface ASTParenthesized {
  type: 'Parenthesized'
  expression: ASTNode
}

interface ASTFunctionCall {
  type: 'FunctionCall'
  functionName: string
  arguments: ASTNode[]
}

// =============================================================================
// Operator Mappings
// =============================================================================

/**
 * Map Expr comparison operators to FilterOperator types
 */
const COMPARISON_OPERATOR_MAP: Record<string, FilterOperator> = {
  '==': 'eq',
  '!=': 'neq',
  '>': 'gt',
  '<': 'lt',
  '>=': 'gte',
  '<=': 'lte',
}

/**
 * Map Expr logical operators to LogicOperator types
 */
const LOGICAL_OPERATOR_MAP: Record<string, LogicOperator> = {
  '&&': 'and',
  and: 'and',
  '||': 'or',
  or: 'or',
}

/**
 * Arithmetic operators
 */
const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%']

/**
 * Operators that don't require a value (null checks)
 */
const NO_VALUE_OPERATORS: FilterOperator[] = ['isNull', 'isNotNull']

// =============================================================================
// CST to AST Transformation
// =============================================================================

/**
 * Get the text content of a syntax node
 */
function getNodeText(node: SyntaxNode, source: string): string {
  return source.slice(node.from, node.to)
}

/**
 * Parse a CST node into an intermediate AST
 */
function parseNode(cursor: TreeCursor, source: string): ASTNode | null {
  const nodeName = cursor.name

  switch (nodeName) {
    case 'Expr':
    case 'ParenthesizedExpr': {
      // Navigate to the child expression
      if (cursor.firstChild()) {
        // Skip opening paren if present
        if (cursor.name === '(') {
          cursor.nextSibling()
        }
        const result = parseNode(cursor, source)
        cursor.parent()
        if (result && nodeName === 'ParenthesizedExpr') {
          return { type: 'Parenthesized', expression: result }
        }
        return result
      }
      return null
    }

    case 'BinaryExpr': {
      if (!cursor.firstChild()) return null

      const left = parseNode(cursor, source)
      if (!left) {
        cursor.parent()
        return null
      }

      // Find the operator
      let operator: string | null = null
      while (cursor.nextSibling()) {
        const name = cursor.name
        if (name === 'CompareOp' || name === 'LogicOp' || name === 'ArithmeticOp') {
          operator = getNodeText(cursor.node, source).trim()
          break
        }
        // Handle special operators like 'in', 'not in'
        if (name === 'in' || name === 'not') {
          let opText = name
          // Check for 'not in' pattern
          if (name === 'not' && cursor.nextSibling() && cursor.name === 'in') {
            opText = 'not in'
          }
          operator = opText
          break
        }
      }

      if (!operator) {
        cursor.parent()
        return null
      }

      // Find the right operand
      cursor.nextSibling()
      const right = parseNode(cursor, source)

      cursor.parent()

      if (!right) return null

      return {
        type: 'BinaryExpr',
        operator,
        left,
        right,
      }
    }

    case 'UnaryExpr': {
      if (!cursor.firstChild()) return null

      let operator: string | null = null
      if (cursor.name === 'LogicOp' || cursor.name === 'ArithmeticOp') {
        operator = getNodeText(cursor.node, source).trim()
        cursor.nextSibling()
      } else if (cursor.name === '!' || cursor.name === 'not') {
        operator = cursor.name === 'not' ? 'not' : '!'
        cursor.nextSibling()
      }

      const operand = parseNode(cursor, source)
      cursor.parent()

      if (!operator || !operand) return null

      return {
        type: 'UnaryExpr',
        operator,
        operand,
      }
    }

    case 'VarName':
    case 'FieldName':
    case 'SelectorExpr': {
      // Handle dot notation like "user.name"
      const name = getNodeText(cursor.node, source)
      return { type: 'Identifier', name }
    }

    case 'Integer': {
      const text = getNodeText(cursor.node, source)
      return { type: 'Literal', value: parseInt(text, 10), literalType: 'number' }
    }

    case 'Float': {
      const text = getNodeText(cursor.node, source)
      return { type: 'Literal', value: parseFloat(text), literalType: 'number' }
    }

    case 'String': {
      const text = getNodeText(cursor.node, source)
      // Remove quotes and unescape
      const unquoted = text.slice(1, -1).replace(/\\(.)/g, '$1')
      return { type: 'Literal', value: unquoted, literalType: 'string' }
    }

    case 'Bool': {
      const text = getNodeText(cursor.node, source)
      return { type: 'Literal', value: text === 'true', literalType: 'boolean' }
    }

    case 'Nil': {
      return { type: 'Literal', value: null, literalType: 'nil' }
    }

    case 'Array': {
      const elements: ASTNode[] = []
      if (cursor.firstChild()) {
        do {
          if (cursor.name !== '[' && cursor.name !== ']' && cursor.name !== ',') {
            const element = parseNode(cursor, source)
            if (element) elements.push(element)
          }
        } while (cursor.nextSibling())
        cursor.parent()
      }
      return { type: 'Array', elements }
    }

    case 'CallExpr': {
      // Function call like int(event_id) or len(name)
      if (!cursor.firstChild()) return null

      // Get the function name (first child should be the callee - VarName/FieldName)
      let functionName: string | null = null
      if (cursor.name === 'VarName' || cursor.name === 'FieldName' || cursor.name === 'SelectorExpr') {
        functionName = getNodeText(cursor.node, source)
      }

      if (!functionName) {
        cursor.parent()
        return null
      }

      // Collect arguments
      const args: ASTNode[] = []

      // Move to Arguments node or directly to argument expressions
      while (cursor.nextSibling()) {
        const nodeName = cursor.name
        if (nodeName === 'Arguments') {
          // Navigate into Arguments
          if (cursor.firstChild()) {
            do {
              const childName = cursor.name
              // Skip parentheses and commas
              if (childName !== '(' && childName !== ')' && childName !== ',') {
                const arg = parseNode(cursor, source)
                if (arg) {
                  args.push(arg)
                }
              }
            } while (cursor.nextSibling())
            cursor.parent() // Exit Arguments
          }
          break
        } else if (nodeName !== '(' && nodeName !== ')' && nodeName !== ',') {
          // Direct argument (some parsers might not wrap in Arguments)
          const arg = parseNode(cursor, source)
          if (arg) {
            args.push(arg)
          }
        }
      }

      cursor.parent()

      return {
        type: 'FunctionCall',
        functionName,
        arguments: args,
      }
    }

    default: {
      // Try to parse children for unknown node types
      if (cursor.firstChild()) {
        const result = parseNode(cursor, source)
        cursor.parent()
        return result
      }
      return null
    }
  }
}

// =============================================================================
// AST to FilterGroup/FilterRule Transformation
// =============================================================================

/**
 * Context for tracking unsupported features during transformation
 */
interface TransformContext {
  unsupportedFeatures: string[]
  availableFields?: Array<{ name: string; type: string }>
}

/**
 * Infer field type from value or default to string
 */
function inferFieldType(value: ASTLiteral['value'], literalType: ASTLiteral['literalType']): string {
  switch (literalType) {
    case 'number':
      return typeof value === 'number' && Number.isInteger(value) ? 'int' : 'float64'
    case 'boolean':
      return 'bool'
    case 'nil':
      return 'string' // Default for nil comparisons
    default:
      return 'string'
  }
}

/**
 * Check if an AST node represents an arithmetic expression
 * (binary arithmetic operation or function call used in arithmetic context)
 */
function isArithmeticExpression(node: ASTNode): boolean {
  if (node.type === 'BinaryExpr') {
    return ARITHMETIC_OPERATORS.includes(node.operator)
  }
  if (node.type === 'Parenthesized') {
    return isArithmeticExpression(node.expression)
  }
  // Function calls like int(x) can be part of arithmetic expressions
  if (node.type === 'FunctionCall') {
    return true
  }
  return false
}

/**
 * Convert an AST node to an arithmetic operand
 */
function toArithmeticOperand(
  node: ASTNode,
  ctx: TransformContext,
): ArithmeticOperand | ArithmeticExpressionNode | null {
  if (node.type === 'Identifier') {
    return {
      type: 'field',
      field: node.name,
      fieldType: 'float64', // Assume numeric for arithmetic
    }
  }

  if (node.type === 'Literal' && node.literalType === 'number') {
    return {
      type: 'literal',
      value: node.value as number,
    }
  }

  if (node.type === 'Parenthesized') {
    return toArithmeticOperand(node.expression, ctx)
  }

  if (node.type === 'FunctionCall') {
    // Convert function call arguments to arithmetic operands
    const args: ArithmeticOperand[] = []
    for (const arg of node.arguments) {
      const operand = toArithmeticOperand(arg, ctx)
      if (!operand) return null
      // Function arguments should be simple operands, not full expressions
      if ('operator' in operand && 'left' in operand && 'right' in operand) {
        ctx.unsupportedFeatures.push('Complex expressions inside function arguments')
        return null
      }
      args.push(operand as ArithmeticOperand)
    }

    const result: ArithmeticFunctionCallOperand = {
      type: 'function',
      functionName: node.functionName,
      arguments: args,
    }
    return result
  }

  if (node.type === 'BinaryExpr' && ARITHMETIC_OPERATORS.includes(node.operator)) {
    const left = toArithmeticOperand(node.left, ctx)
    const right = toArithmeticOperand(node.right, ctx)

    if (!left || !right) return null

    return {
      id: uuidv4(),
      left,
      operator: node.operator as ArithmeticOperator,
      right,
    }
  }

  return null
}

/**
 * Extract field name from an AST node
 */
function extractFieldName(node: ASTNode): string | null {
  if (node.type === 'Identifier') {
    return node.name
  }
  if (node.type === 'Parenthesized') {
    return extractFieldName(node.expression)
  }
  return null
}

/**
 * Extract literal value from an AST node
 */
function extractLiteral(node: ASTNode): { value: string | number | boolean; type: string } | null {
  if (node.type === 'Literal') {
    if (node.literalType === 'nil') {
      return null // nil is handled specially
    }
    return {
      value: node.value as string | number | boolean,
      type: inferFieldType(node.value, node.literalType),
    }
  }
  if (node.type === 'Parenthesized') {
    return extractLiteral(node.expression)
  }
  return null
}

/**
 * Extract array values for in/notIn operators
 */
function extractArrayValues(node: ASTNode): string | null {
  if (node.type === 'Array') {
    const values = node.elements
      .map((el) => {
        if (el.type === 'Literal') {
          return String(el.value)
        }
        return null
      })
      .filter((v): v is string => v !== null)

    return values.join(', ')
  }
  return null
}

/**
 * Transform a comparison expression into a FilterRule
 */
function transformComparison(ast: ASTBinaryExpr, ctx: TransformContext, not: boolean = false): FilterRule | null {
  const { operator, left, right } = ast

  // Handle 'in' and 'not in' operators
  if (operator === 'in' || operator === 'not in') {
    const fieldName = extractFieldName(left)
    const arrayValues = extractArrayValues(right)

    if (!fieldName || arrayValues === null) {
      ctx.unsupportedFeatures.push(`Complex ${operator} expression`)
      return null
    }

    // Infer type from first array element
    let fieldType = 'string'
    if (right.type === 'Array' && right.elements.length > 0) {
      const firstEl = right.elements[0]
      if (firstEl.type === 'Literal') {
        fieldType = inferFieldType(firstEl.value, firstEl.literalType)
      }
    }

    return {
      id: uuidv4(),
      type: 'rule',
      field: fieldName,
      fieldType,
      operator: operator === 'in' ? 'in' : 'notIn',
      value: arrayValues,
      not,
    }
  }

  // Handle standard comparison operators
  const mappedOp = COMPARISON_OPERATOR_MAP[operator]
  if (!mappedOp) {
    ctx.unsupportedFeatures.push(`Unsupported operator: ${operator}`)
    return null
  }

  // Check for nil comparison (isNull / isNotNull)
  if (right.type === 'Literal' && right.literalType === 'nil') {
    const fieldName = extractFieldName(left)
    if (!fieldName) {
      ctx.unsupportedFeatures.push('Complex nil comparison')
      return null
    }

    let finalOp: FilterOperator
    if (operator === '==') {
      finalOp = not ? 'isNotNull' : 'isNull'
    } else if (operator === '!=') {
      finalOp = not ? 'isNull' : 'isNotNull'
    } else {
      ctx.unsupportedFeatures.push(`Invalid nil operator: ${operator}`)
      return null
    }

    return {
      id: uuidv4(),
      type: 'rule',
      field: fieldName,
      fieldType: 'string',
      operator: finalOp,
      value: '',
      not: false, // NOT is absorbed into the operator
    }
  }

  // Check if left side is an arithmetic expression (or single operand e.g. concat(a,b))
  if (isArithmeticExpression(left)) {
    const result = toArithmeticOperand(left, ctx)
    const literal = extractLiteral(right)

    if (!result || !literal) {
      ctx.unsupportedFeatures.push('Complex arithmetic comparison')
      return null
    }

    // If result is a full expression node (binary arithmetic), use as-is.
    // If it's a single operand (field or function call), wrap in synthetic node so
    // serialization and UI match what manual mode produces.
    const arithmeticExpr: ArithmeticExpressionNode =
      'operator' in result && 'left' in result && 'right' in result
        ? (result as ArithmeticExpressionNode)
        : {
            id: uuidv4(),
            left: result as ArithmeticOperand,
            operator: '+' as ArithmeticOperator,
            right: { type: 'literal', value: 0 },
          }

    return {
      id: uuidv4(),
      type: 'rule',
      field: '',
      fieldType: 'float64',
      useArithmeticExpression: true,
      arithmeticExpression: arithmeticExpr,
      operator: mappedOp,
      value: literal.value,
      not,
    }
  }

  // Standard field comparison
  const fieldName = extractFieldName(left)
  const literal = extractLiteral(right)

  if (!fieldName || !literal) {
    // Try swapping left and right (e.g., "10 > field" -> "field < 10")
    const swappedFieldName = extractFieldName(right)
    const swappedLiteral = extractLiteral(left)

    if (swappedFieldName && swappedLiteral) {
      // Swap the operator
      const swappedOps: Record<string, FilterOperator> = {
        gt: 'lt',
        lt: 'gt',
        gte: 'lte',
        lte: 'gte',
        eq: 'eq',
        neq: 'neq',
      }
      const swappedMappedOp = swappedOps[mappedOp]

      if (swappedMappedOp) {
        return {
          id: uuidv4(),
          type: 'rule',
          field: swappedFieldName,
          fieldType: swappedLiteral.type,
          operator: swappedMappedOp,
          value: swappedLiteral.value,
          not,
        }
      }
    }

    ctx.unsupportedFeatures.push('Complex comparison expression')
    return null
  }

  return {
    id: uuidv4(),
    type: 'rule',
    field: fieldName,
    fieldType: literal.type,
    operator: mappedOp,
    value: literal.value,
    not,
  }
}

/**
 * Transform an AST node into a FilterGroup or FilterRule
 */
function transformAST(ast: ASTNode, ctx: TransformContext): FilterGroup | FilterRule | null {
  // Handle parenthesized expressions
  if (ast.type === 'Parenthesized') {
    return transformAST(ast.expression, ctx)
  }

  // Handle unary NOT expressions
  if (ast.type === 'UnaryExpr' && (ast.operator === '!' || ast.operator === 'not')) {
    const inner = transformAST(ast.operand, ctx)
    if (!inner) return null

    // Apply NOT to the inner result
    if (inner.type === 'rule') {
      return { ...inner, not: !inner.not }
    } else {
      return { ...inner, not: !inner.not }
    }
  }

  // Handle binary expressions
  if (ast.type === 'BinaryExpr') {
    const { operator } = ast

    // Check if this is a logical operator (AND/OR)
    const logicOp = LOGICAL_OPERATOR_MAP[operator]
    if (logicOp) {
      // Collect all operands at this precedence level
      const children: (FilterGroup | FilterRule)[] = []
      const collectOperands = (node: ASTNode, expectedOp: string) => {
        if (node.type === 'BinaryExpr' && LOGICAL_OPERATOR_MAP[node.operator] === logicOp) {
          collectOperands(node.left, expectedOp)
          collectOperands(node.right, expectedOp)
        } else if (node.type === 'Parenthesized') {
          // Don't flatten through parentheses - they create explicit grouping
          const inner = transformAST(node, ctx)
          if (inner) children.push(inner)
        } else {
          const transformed = transformAST(node, ctx)
          if (transformed) children.push(transformed)
        }
      }

      collectOperands(ast, operator)

      if (children.length === 0) return null
      if (children.length === 1) return children[0]

      return {
        id: uuidv4(),
        type: 'group',
        combinator: logicOp,
        not: false,
        children,
      }
    }

    // This is a comparison expression
    return transformComparison(ast, ctx)
  }

  // Single identifier or literal shouldn't appear at top level
  ctx.unsupportedFeatures.push(`Unexpected expression type: ${ast.type}`)
  return null
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parse an Expr expression string into a FilterGroup tree
 *
 * @param expression - The Expr expression string to parse
 * @returns ParseResult with the reconstructed filter tree or error information
 *
 * @example
 * ```ts
 * const result = parseExprToFilterTree('status == "active" && price > 100')
 * if (result.success && result.filterGroup) {
 *   // Use filterGroup to populate the UI
 * }
 * ```
 */
export function parseExprToFilterTree(expression: string): ParseResult {
  if (!expression || !expression.trim()) {
    return {
      success: false,
      error: 'Empty expression',
    }
  }

  try {
    // Parse the expression using @exprlang/parser
    const tree = parser.parse(expression)
    const cursor = tree.cursor()

    // Navigate to the actual expression content
    if (!cursor.firstChild()) {
      return {
        success: false,
        error: 'Failed to parse expression: empty parse tree',
      }
    }

    // Parse CST to intermediate AST
    const ast = parseNode(cursor, expression)

    if (!ast) {
      return {
        success: false,
        error: 'Failed to convert expression to AST',
      }
    }

    // Transform AST to FilterGroup/FilterRule
    const ctx: TransformContext = {
      unsupportedFeatures: [],
    }

    const result = transformAST(ast, ctx)

    if (!result) {
      return {
        success: false,
        error: 'Failed to transform expression to filter tree',
        unsupportedFeatures: ctx.unsupportedFeatures,
      }
    }

    // Wrap single rule in a group
    let filterGroup: FilterGroup
    if (result.type === 'rule') {
      filterGroup = {
        id: uuidv4(),
        type: 'group',
        combinator: 'and',
        not: false,
        children: [result],
      }
    } else {
      filterGroup = result
    }

    return {
      success: true,
      filterGroup,
      unsupportedFeatures: ctx.unsupportedFeatures.length > 0 ? ctx.unsupportedFeatures : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Check if an expression can be parsed and represented in the UI
 *
 * @param expression - The expression to validate
 * @returns true if the expression can be fully represented in the UI
 */
export function canParseExpression(expression: string): boolean {
  const result = parseExprToFilterTree(expression)
  return result.success && (!result.unsupportedFeatures || result.unsupportedFeatures.length === 0)
}
