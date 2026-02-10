/**
 * Manual test cases for the Expr Expression Parser
 *
 * Since no testing framework is configured, this file provides test utilities
 * that can be run manually to verify parser behavior.
 *
 * Run in browser console or Node.js to validate:
 * ```ts
 * import { runParserTests } from './exprParser.test'
 * runParserTests()
 * ```
 */

import { parseExprToFilterTree, canParseExpression, ParseResult } from './exprParser'

interface TestCase {
  name: string
  expression: string
  expectedSuccess: boolean
  validate?: (result: ParseResult) => boolean
}

/**
 * Test cases covering common expression patterns
 */
export const TEST_CASES: TestCase[] = [
  // Simple comparisons
  {
    name: 'Simple string equality',
    expression: 'status == "active"',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.field === 'status' && rule.operator === 'eq' && rule.value === 'active'
    },
  },
  {
    name: 'Simple string inequality',
    expression: 'status != "deleted"',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'neq'
    },
  },
  {
    name: 'Numeric greater than',
    expression: 'price > 100',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.field === 'price' && rule.operator === 'gt' && rule.value === 100
    },
  },
  {
    name: 'Numeric less than or equal',
    expression: 'count <= 50',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'lte'
    },
  },
  {
    name: 'Boolean literal comparison',
    expression: 'is_enabled == true',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.value === true && rule.fieldType === 'bool'
    },
  },
  {
    name: 'Float comparison',
    expression: 'rate >= 3.14',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.fieldType === 'float64'
    },
  },

  // Null checks
  {
    name: 'Is null check',
    expression: 'email == nil',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'isNull'
    },
  },
  {
    name: 'Is not null check',
    expression: 'email != nil',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'isNotNull'
    },
  },

  // Logical AND/OR
  {
    name: 'Two conditions with AND (&&)',
    expression: 'a == 1 && b == 2',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'and' && r.filterGroup?.children.length === 2
    },
  },
  {
    name: 'Two conditions with AND (keyword)',
    expression: 'a == 1 and b == 2',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'and'
    },
  },
  {
    name: 'Two conditions with OR (||)',
    expression: 'a == 1 || b == 2',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'or' && r.filterGroup?.children.length === 2
    },
  },
  {
    name: 'Two conditions with OR (keyword)',
    expression: 'x == "a" or y == "b"',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'or'
    },
  },
  {
    name: 'Three conditions with same operator',
    expression: 'a == 1 && b == 2 && c == 3',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'and' && r.filterGroup?.children.length === 3
    },
  },

  // Nested groups with parentheses
  {
    name: 'Nested groups: (A || B) && C',
    expression: '(a == 1 || b == 2) && c == 3',
    expectedSuccess: true,
    validate: (r) => {
      const group = r.filterGroup
      if (group?.combinator !== 'and' || group?.children.length !== 2) return false
      const nested = group.children[0]
      return nested?.type === 'group' && nested.combinator === 'or'
    },
  },
  {
    name: 'Nested groups: A && (B || C)',
    expression: 'a == 1 && (b == 2 || c == 3)',
    expectedSuccess: true,
    validate: (r) => {
      const group = r.filterGroup
      if (group?.combinator !== 'and' || group?.children.length !== 2) return false
      const nested = group.children[1]
      return nested?.type === 'group' && nested.combinator === 'or'
    },
  },

  // NOT expressions
  {
    name: 'NOT on single condition',
    expression: '!(status == "deleted")',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.not === true
    },
  },
  {
    name: 'NOT with keyword',
    expression: 'not (price > 100)',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.not === true
    },
  },

  // In/Not In operators
  {
    name: 'In operator with string array',
    expression: 'status in ["active", "pending"]',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'in' && rule.value === 'active, pending'
    },
  },
  {
    name: 'In operator with number array',
    expression: 'type in [1, 2, 3]',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'in' && rule.fieldType === 'int'
    },
  },
  {
    name: 'Not in operator',
    expression: 'status not in ["deleted", "archived"]',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.operator === 'notIn'
    },
  },

  // Arithmetic expressions
  {
    name: 'Simple arithmetic: addition',
    expression: '(price + tax) > 100',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return (
        rule?.type === 'rule' && rule.useArithmeticExpression === true && rule.arithmeticExpression?.operator === '+'
      )
    },
  },
  {
    name: 'Arithmetic: subtraction',
    expression: '(total - discount) >= 50',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return (
        rule?.type === 'rule' && rule.useArithmeticExpression === true && rule.arithmeticExpression?.operator === '-'
      )
    },
  },
  {
    name: 'Arithmetic: multiplication',
    expression: '(quantity * price) > 1000',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.arithmeticExpression?.operator === '*'
    },
  },
  {
    name: 'Arithmetic with literal',
    expression: '(price * 1.1) > 100',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      if (rule?.type !== 'rule' || !rule.arithmeticExpression) return false
      const right = rule.arithmeticExpression.right
      return 'type' in right && right.type === 'literal'
    },
  },

  // Dot notation (field paths)
  {
    name: 'Dot notation field access',
    expression: 'user.name == "John"',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      return rule?.type === 'rule' && rule.field === 'user.name'
    },
  },

  // Function calls in arithmetic expressions
  {
    name: 'Function call: int() type conversion',
    expression: 'int(event_id) % 2 == 0',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      if (rule?.type !== 'rule' || !rule.arithmeticExpression) return false
      // Left side of the arithmetic expression should be the function call
      const left = rule.arithmeticExpression.left
      return 'type' in left && left.type === 'function' && left.functionName === 'int'
    },
  },
  {
    name: 'Function call: len() with comparison',
    expression: 'len(name) > 5',
    expectedSuccess: true,
    validate: (r) => {
      const rule = r.filterGroup?.children[0]
      if (rule?.type !== 'rule') return false
      // This is a simple comparison where left side is a function call
      // It should be parsed as an arithmetic expression
      if (!rule.arithmeticExpression) {
        // Or it might be parsed as a direct function call comparison
        return rule.field === 'len(name)'
      }
      return true
    },
  },

  // Complex expressions
  {
    name: 'Complex: multiple groups',
    expression: '(status == "active" && type == 1) || (status == "pending" && priority > 5)',
    expectedSuccess: true,
    validate: (r) => {
      return r.filterGroup?.combinator === 'or' && r.filterGroup?.children.every((c) => c.type === 'group')
    },
  },

  // Edge cases
  {
    name: 'Empty expression',
    expression: '',
    expectedSuccess: false,
  },
  {
    name: 'Whitespace only',
    expression: '   ',
    expectedSuccess: false,
  },
  {
    name: 'Single quoted string',
    expression: "status == 'active'",
    expectedSuccess: true,
  },
]

/**
 * Run all test cases and report results
 */
export function runParserTests(): { passed: number; failed: number; results: string[] } {
  const results: string[] = []
  let passed = 0
  let failed = 0

  for (const testCase of TEST_CASES) {
    try {
      const result = parseExprToFilterTree(testCase.expression)
      const successMatches = result.success === testCase.expectedSuccess
      const validatePasses = testCase.validate ? testCase.validate(result) : true

      if (successMatches && validatePasses) {
        passed++
        results.push(`✓ ${testCase.name}`)
      } else {
        failed++
        results.push(
          `✗ ${testCase.name}\n` +
            `  Expression: ${testCase.expression}\n` +
            `  Expected success: ${testCase.expectedSuccess}, got: ${result.success}\n` +
            `  Validation: ${validatePasses ? 'passed' : 'FAILED'}\n` +
            `  Error: ${result.error || 'none'}`,
        )
      }
    } catch (error) {
      failed++
      results.push(`✗ ${testCase.name}\n` + `  Expression: ${testCase.expression}\n` + `  Exception: ${error}`)
    }
  }

  console.log('\n=== Parser Test Results ===\n')
  results.forEach((r) => console.log(r))
  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`)

  return { passed, failed, results }
}

/**
 * Test a single expression and log detailed output
 */
export function testExpression(expression: string): void {
  console.log(`\nTesting expression: "${expression}"`)
  console.log('---')

  const result = parseExprToFilterTree(expression)

  console.log('Success:', result.success)

  if (result.error) {
    console.log('Error:', result.error)
  }

  if (result.unsupportedFeatures?.length) {
    console.log('Unsupported features:', result.unsupportedFeatures)
  }

  if (result.filterGroup) {
    console.log('Filter Group:', JSON.stringify(result.filterGroup, null, 2))
  }

  console.log('Can parse:', canParseExpression(expression))
}

/**
 * Export for use in browser console or tests
 */
export const parserTestUtils = {
  runParserTests,
  testExpression,
  TEST_CASES,
}
