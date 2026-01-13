/**
 * Arithmetic Expression Parser
 *
 * Parses arithmetic expression strings (e.g., "a + b * c") into
 * ArithmeticExpressionNode structures for the filter UI.
 *
 * Uses @exprlang/parser (Lezer-based) to parse expressions.
 */

import { parser } from '@exprlang/parser'
import type { TreeCursor } from '@lezer/common'
import { v4 as uuidv4 } from 'uuid'
import type { ArithmeticExpressionNode, ArithmeticOperand, ArithmeticOperator } from '@/src/store/filter.store'

// =============================================================================
// Types
// =============================================================================

/**
 * Result of parsing an arithmetic expression
 */
export interface ArithmeticParseResult {
  /** Whether parsing was successful */
  success: boolean
  /** The parsed expression (if successful) */
  expression?: ArithmeticExpressionNode
  /** Error message (if parsing failed) */
  error?: string
}

/**
 * Internal intermediate AST node types for arithmetic expressions
 */
type ArithmeticASTNode = ASTBinaryExpr | ASTIdentifier | ASTLiteral | ASTParenthesized | ASTUnaryExpr

interface ASTBinaryExpr {
  type: 'BinaryExpr'
  operator: string
  left: ArithmeticASTNode
  right: ArithmeticASTNode
}

interface ASTUnaryExpr {
  type: 'UnaryExpr'
  operator: string
  operand: ArithmeticASTNode
}

interface ASTIdentifier {
  type: 'Identifier'
  name: string
}

interface ASTLiteral {
  type: 'Literal'
  value: number
}

interface ASTParenthesized {
  type: 'Parenthesized'
  expression: ArithmeticASTNode
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Valid arithmetic operators
 */
const VALID_ARITHMETIC_OPERATORS: ArithmeticOperator[] = ['+', '-', '*', '/', '%']

// =============================================================================
// CST to AST Transformation
// =============================================================================

/**
 * Get the text content of a syntax node
 */
function getNodeText(cursor: TreeCursor, source: string): string {
  return source.slice(cursor.from, cursor.to)
}

/**
 * Parse a CST node into an intermediate AST for arithmetic expressions
 */
function parseArithmeticNode(cursor: TreeCursor, source: string): ArithmeticASTNode | null {
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
        const result = parseArithmeticNode(cursor, source)
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

      const left = parseArithmeticNode(cursor, source)
      if (!left) {
        cursor.parent()
        return null
      }

      // Find the operator
      let operator: string | null = null
      while (cursor.nextSibling()) {
        const name = cursor.name
        if (name === 'ArithmeticOp') {
          operator = getNodeText(cursor, source).trim()
          break
        }
        // Also check for raw operator tokens
        if (['+', '-', '*', '/', '%'].includes(name)) {
          operator = name
          break
        }
      }

      if (!operator) {
        cursor.parent()
        return null
      }

      // Find the right operand
      cursor.nextSibling()
      const right = parseArithmeticNode(cursor, source)

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
      if (cursor.name === 'ArithmeticOp' || cursor.name === '-') {
        operator = getNodeText(cursor, source).trim()
        cursor.nextSibling()
      }

      const operand = parseArithmeticNode(cursor, source)
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
      const name = getNodeText(cursor, source)
      return { type: 'Identifier', name }
    }

    case 'Integer': {
      const text = getNodeText(cursor, source)
      return { type: 'Literal', value: parseInt(text, 10) }
    }

    case 'Float': {
      const text = getNodeText(cursor, source)
      return { type: 'Literal', value: parseFloat(text) }
    }

    default: {
      // Try to parse children
      if (cursor.firstChild()) {
        const result = parseArithmeticNode(cursor, source)
        cursor.parent()
        return result
      }
      return null
    }
  }
}

// =============================================================================
// AST to ArithmeticExpressionNode Transformation
// =============================================================================

/**
 * Transform an intermediate AST node to ArithmeticOperand or ArithmeticExpressionNode
 */
function transformToOperand(
  ast: ArithmeticASTNode,
  availableFields: string[],
): ArithmeticOperand | ArithmeticExpressionNode | { error: string } {
  switch (ast.type) {
    case 'Identifier': {
      // Check if the field exists in available fields
      if (availableFields.length > 0 && !availableFields.includes(ast.name)) {
        return { error: `Unknown field: "${ast.name}"` }
      }
      return {
        type: 'field',
        field: ast.name,
        fieldType: 'float64', // Assume numeric for arithmetic
      }
    }

    case 'Literal': {
      return {
        type: 'literal',
        value: ast.value,
      }
    }

    case 'Parenthesized': {
      return transformToOperand(ast.expression, availableFields)
    }

    case 'UnaryExpr': {
      // Handle unary minus for negative numbers
      if (ast.operator === '-' && ast.operand.type === 'Literal') {
        return {
          type: 'literal',
          value: -ast.operand.value,
        }
      }
      // For other unary expressions, try to transform the operand
      return transformToOperand(ast.operand, availableFields)
    }

    case 'BinaryExpr': {
      // Validate operator
      if (!VALID_ARITHMETIC_OPERATORS.includes(ast.operator as ArithmeticOperator)) {
        return { error: `Invalid operator: "${ast.operator}". Only arithmetic operators (+, -, *, /, %) are allowed.` }
      }

      const left = transformToOperand(ast.left, availableFields)
      if ('error' in left) return left

      const right = transformToOperand(ast.right, availableFields)
      if ('error' in right) return right

      return {
        id: uuidv4(),
        left,
        operator: ast.operator as ArithmeticOperator,
        right,
      }
    }

    default:
      return { error: 'Unsupported expression type' }
  }
}

/**
 * Transform the root AST to an ArithmeticExpressionNode
 * If the AST is a simple operand, wrap it in a default expression
 */
function transformToExpression(
  ast: ArithmeticASTNode,
  availableFields: string[],
): ArithmeticExpressionNode | { error: string } {
  const result = transformToOperand(ast, availableFields)

  if ('error' in result) {
    return result
  }

  // If it's already an expression node, return it
  if ('operator' in result && 'left' in result && 'right' in result) {
    return result as ArithmeticExpressionNode
  }

  // It's a simple operand - this is not a valid arithmetic expression
  // An arithmetic expression needs at least one operator
  return { error: 'Expression must contain at least one arithmetic operation (e.g., a + b)' }
}

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parse an arithmetic expression string into an ArithmeticExpressionNode
 *
 * @param input - The expression string to parse (e.g., "price + tax * 0.1")
 * @param availableFields - List of valid field names (for validation). Empty array skips validation.
 * @returns ParseResult with the expression or error information
 *
 * @example
 * ```ts
 * const result = parseArithmeticExpression('price + tax', ['price', 'tax', 'discount'])
 * if (result.success && result.expression) {
 *   // Use expression in the UI
 * }
 * ```
 */
export function parseArithmeticExpression(input: string, availableFields: string[] = []): ArithmeticParseResult {
  if (!input || !input.trim()) {
    return {
      success: false,
      error: 'Expression cannot be empty',
    }
  }

  try {
    // Parse the expression using @exprlang/parser
    const tree = parser.parse(input.trim())
    const cursor = tree.cursor()

    // Navigate to the actual expression content
    if (!cursor.firstChild()) {
      return {
        success: false,
        error: 'Failed to parse expression: empty parse tree',
      }
    }

    // Parse CST to intermediate AST
    const ast = parseArithmeticNode(cursor, input.trim())

    if (!ast) {
      return {
        success: false,
        error: 'Failed to parse expression. Check syntax.',
      }
    }

    // Transform AST to ArithmeticExpressionNode
    const result = transformToExpression(ast, availableFields)

    if ('error' in result) {
      return {
        success: false,
        error: result.error,
      }
    }

    return {
      success: true,
      expression: result,
    }
  } catch (error) {
    return {
      success: false,
      error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

/**
 * Validate an arithmetic expression string without fully parsing it
 *
 * @param input - The expression string to validate
 * @param availableFields - List of valid field names
 * @returns true if valid, error message string if invalid
 */
export function validateArithmeticExpressionString(input: string, availableFields: string[] = []): true | string {
  const result = parseArithmeticExpression(input, availableFields)
  return result.success ? true : result.error || 'Invalid expression'
}
