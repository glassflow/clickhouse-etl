import { NextResponse } from 'next/server'

/**
 * Mock filter expression validation endpoint
 * POST /ui-api/mock/filter/validate
 *
 * Validates filter expressions similar to how the backend does with expr-lang.
 * This mock implementation performs basic validation checks to simulate
 * the backend behavior for testing in mock mode.
 */

interface StreamDataField {
  field_name: string
  field_type: string
}

interface ValidateFilterRequest {
  expression: string
  fields: StreamDataField[]
}

// Supported operators that expr-lang supports
const COMPARISON_OPERATORS = ['==', '!=', '>', '<', '>=', '<=']
const LOGICAL_OPERATORS = ['and', 'or', '&&', '||']
const STRING_FUNCTIONS = ['contains', 'startsWith', 'endsWith']

/**
 * Basic validation that mimics expr-lang behavior
 * Returns null if valid, or an error message if invalid
 */
function validateExpression(expression: string, fields: StreamDataField[]): string | null {
  // Check for empty expression
  if (!expression || expression.trim() === '') {
    return 'empty expression'
  }

  const trimmedExpr = expression.trim()

  // Check for balanced parentheses
  let parenCount = 0
  for (const char of trimmedExpr) {
    if (char === '(') parenCount++
    if (char === ')') parenCount--
    if (parenCount < 0) {
      return 'compile expression: unmatched parentheses'
    }
  }
  if (parenCount !== 0) {
    return 'compile expression: unmatched parentheses'
  }

  // Check for balanced quotes
  const doubleQuoteCount = (trimmedExpr.match(/"/g) || []).length
  if (doubleQuoteCount % 2 !== 0) {
    return 'compile expression: unmatched double quotes'
  }

  // Create a set of valid field names for quick lookup
  const validFieldNames = new Set(fields.map((f) => f.field_name))
  const fieldTypeMap = new Map(fields.map((f) => [f.field_name, f.field_type]))

  // Extract field references from the expression (words that could be field names)
  // This is a simplified check - the real expr-lang does much more sophisticated parsing
  const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g
  const reservedWords = new Set([
    'and',
    'or',
    'not',
    'true',
    'false',
    'nil',
    'contains',
    'startsWith',
    'endsWith',
    'in',
  ])

  let match: RegExpExecArray | null
  const usedFields: string[] = []

  // Create a copy for matching (remove string literals first)
  const exprWithoutStrings = trimmedExpr.replace(/"[^"]*"/g, '""')

  while ((match = fieldPattern.exec(exprWithoutStrings)) !== null) {
    const word = match[1]
    // Skip reserved words, operators, and numeric literals
    if (reservedWords.has(word.toLowerCase())) continue
    if (/^\d+$/.test(word)) continue

    // Check if this looks like a field reference
    if (!validFieldNames.has(word)) {
      // Only report error if it's not a known function or keyword
      if (!STRING_FUNCTIONS.includes(word)) {
        return `compile expression: unknown name ${word}`
      }
    } else {
      usedFields.push(word)
    }
  }

  // Check for at least one field reference
  if (usedFields.length === 0) {
    // This might be valid if using only literals, but typically filters reference fields
    // Let it pass - the backend will catch truly invalid expressions
  }

  // Check for common syntax errors in function calls
  for (const fn of STRING_FUNCTIONS) {
    const fnPattern = new RegExp(`${fn}\\s*\\(`, 'g')
    const fnCallMatch = fnPattern.exec(trimmedExpr)
    if (fnCallMatch) {
      // Verify the function has proper arguments (simplified check)
      const afterFn = trimmedExpr.substring(fnCallMatch.index + fnCallMatch[0].length)
      if (afterFn.startsWith(')')) {
        return `compile expression: ${fn} requires arguments`
      }
    }
  }

  // Check for boolean result expectation
  // Valid expressions should evaluate to boolean
  // We can't fully evaluate without a real expr engine, so we just check for obvious issues

  // Check for common syntax errors
  const invalidPatterns = [
    { pattern: /==\s*==/, message: 'invalid operator combination' },
    { pattern: /&&\s*&&/, message: 'invalid operator combination' },
    { pattern: /\|\|\s*\|\|/, message: 'invalid operator combination' },
    { pattern: /and\s+and/i, message: 'invalid operator combination' },
    { pattern: /or\s+or/i, message: 'invalid operator combination' },
    { pattern: /^\s*[><=!]+\s*$/, message: 'incomplete expression' },
    { pattern: /\(\s*\)/, message: 'empty parentheses' },
  ]

  for (const { pattern, message } of invalidPatterns) {
    if (pattern.test(trimmedExpr)) {
      return `compile expression: ${message}`
    }
  }

  // Validate type compatibility for comparisons
  // For example, string fields shouldn't use > < operators with numeric values
  const numericComparisons = trimmedExpr.match(/(\w+)\s*([><]=?)\s*(\d+)/g)
  if (numericComparisons) {
    for (const comparison of numericComparisons) {
      const fieldMatch = comparison.match(/^(\w+)/)
      if (fieldMatch) {
        const fieldName = fieldMatch[1]
        const fieldType = fieldTypeMap.get(fieldName)
        if (fieldType === 'string') {
          return `compile expression: cannot use numeric comparison on string field ${fieldName}`
        }
      }
    }
  }

  // All basic checks passed
  return null
}

export async function POST(request: Request) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 100))

  try {
    const body: ValidateFilterRequest = await request.json()
    const { expression, fields } = body

    // Validate input
    if (!expression) {
      return NextResponse.json(
        {
          status: 400,
          code: 'validation_error',
          message: 'Filter expression validation failed',
          details: {
            error: 'expression is required',
          },
        },
        { status: 400 },
      )
    }

    if (!fields || !Array.isArray(fields)) {
      return NextResponse.json(
        {
          status: 400,
          code: 'validation_error',
          message: 'Filter expression validation failed',
          details: {
            error: 'fields array is required',
          },
        },
        { status: 400 },
      )
    }

    // Run validation
    const error = validateExpression(expression, fields)

    if (error) {
      return NextResponse.json(
        {
          status: 400,
          code: 'validation_error',
          message: 'Filter expression validation failed',
          details: {
            error: error,
          },
        },
        { status: 400 },
      )
    }

    // Validation passed - return empty body with 200 status
    // This matches the backend behavior for successful validation
    return new NextResponse(null, { status: 200 })
  } catch (error: any) {
    console.error('[Mock] Filter validation error:', error)
    return NextResponse.json(
      {
        status: 500,
        code: 'internal_error',
        message: 'Filter validation failed',
        details: {
          error: error.message || 'Unknown error',
        },
      },
      { status: 500 },
    )
  }
}
