/**
 * Transformation Function Definitions
 *
 * This file contains all supported transformation functions that can be used
 * to transform Kafka event fields into computed fields in the intermediary schema.
 */

// Function categories for grouping in the UI
export type FunctionCategory = 'url' | 'string' | 'type' | 'datetime' | 'boolean' | 'array' | 'utility'

// Argument type definitions
export interface FunctionArgDef {
  name: string
  description: string
  type: 'field' | 'literal' | 'array' | 'waterfall_array' | 'concat_array'
  literalType?: 'string' | 'number' | 'boolean' // For literal arguments
  fieldTypes?: string[] // Compatible input field types (if type is 'field')
  required?: boolean
  defaultValue?: string | number | boolean
}

// Function definition interface
export interface TransformationFunctionDef {
  name: string
  category: FunctionCategory
  description: string
  args: FunctionArgDef[]
  returnType: string // The output type of the function
  example: {
    input: string
    output: string
  }
}

// All numeric types for convenience (simplified to basic types)
const NUMERIC_TYPES = ['int', 'uint', 'float']
const STRING_TYPES = ['string']
const ALL_TYPES = [...STRING_TYPES, ...NUMERIC_TYPES, 'bool', 'bytes', 'array']

/**
 * All supported transformation functions
 */
export const TRANSFORMATION_FUNCTIONS: TransformationFunctionDef[] = [
  // URL/Query Parsing Functions
  {
    name: 'parseQuery',
    category: 'url',
    description: 'Parse a URL query string into an object',
    args: [
      {
        name: 'queryString',
        description: 'The query string to parse (e.g., "cid=123&sid=456")',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string', // parsed query as string representation; normalized from object for unified type set
    example: {
      input: 'parseQuery("cid=123&sid=456")',
      output: '{"cid": "123", "sid": "456"}',
    },
  },
  {
    name: 'getQueryParam',
    category: 'url',
    description: 'Get a specific parameter value from a query string',
    args: [
      {
        name: 'queryString',
        description: 'The query string to search',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'paramName',
        description: 'The name of the parameter to extract',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'getQueryParam("cid=123&sid=456", "cid")',
      output: '"123"',
    },
  },
  {
    name: 'getNestedParam',
    category: 'url',
    description: 'Get a nested parameter value (e.g., ep.event_id)',
    args: [
      {
        name: 'queryString',
        description: 'The query string to search',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'paramName',
        description: 'The nested parameter name (e.g., "ep.event_id")',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'getNestedParam("ep.event_id=999&ep.value=29.99", "ep.event_id")',
      output: '"999"',
    },
  },
  {
    name: 'urlDecode',
    category: 'url',
    description: 'Decode a URL-encoded string',
    args: [
      {
        name: 'encodedString',
        description: 'The URL-encoded string to decode',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'urlDecode("Hello%20World")',
      output: '"Hello World"',
    },
  },
  {
    name: 'extractPathType',
    category: 'url',
    description: 'Extract the path type from a URL path',
    args: [
      {
        name: 'path',
        description: 'The URL path (e.g., "/g/collect")',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'extractPathType("/g/collect")',
      output: '"collect"',
    },
  },

  // String Manipulation Functions
  {
    name: 'lower',
    category: 'string',
    description: 'Convert a string to lowercase',
    args: [
      {
        name: 'value',
        description: 'The string to convert',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'lower("HELLO")',
      output: '"hello"',
    },
  },
  {
    name: 'upper',
    category: 'string',
    description: 'Convert a string to uppercase',
    args: [
      {
        name: 'value',
        description: 'The string to convert',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'upper("hello")',
      output: '"HELLO"',
    },
  },
  {
    name: 'trim',
    category: 'string',
    description: 'Remove leading and trailing whitespace from a string',
    args: [
      {
        name: 'value',
        description: 'The string to trim',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'trim("  hello  ")',
      output: '"hello"',
    },
  },
  {
    name: 'split',
    category: 'string',
    description: 'Split a string by a delimiter into an array',
    args: [
      {
        name: 'value',
        description: 'The string to split',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'delimiter',
        description: 'The delimiter to split by',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'array',
    example: {
      input: 'split("a,b,c", ",")',
      output: '["a", "b", "c"]',
    },
  },
  {
    name: 'join',
    category: 'string',
    description: 'Join an array of strings with a delimiter',
    args: [
      {
        name: 'values',
        description: 'The array of strings to join',
        type: 'field',
        fieldTypes: ['array'],
        required: true,
      },
      {
        name: 'delimiter',
        description: 'The delimiter to join with',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'join(["a", "b", "c"], ",")',
      output: '"a,b,c"',
    },
  },
  {
    name: 'concat',
    category: 'string',
    description: 'Concatenate multiple strings or fields together',
    args: [
      {
        name: 'values',
        description: 'Values to concatenate (fields or string literals)',
        type: 'concat_array',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'name="John", lastname="Doe"',
      output: 'concat(name, " ", lastname) → "John Doe"',
    },
  },
  {
    name: 'replace',
    category: 'string',
    description: 'Replace occurrences of a substring with another string',
    args: [
      {
        name: 'value',
        description: 'The string to modify',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'search',
        description: 'The substring to find',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
      {
        name: 'replacement',
        description: 'The replacement string',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'replace("hello world", "world", "universe")',
      output: '"hello universe"',
    },
  },

  // Type Conversion Functions
  {
    name: 'toString',
    category: 'type',
    description: 'Convert a value to a string',
    args: [
      {
        name: 'value',
        description: 'The value to convert',
        type: 'field',
        fieldTypes: ALL_TYPES,
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'toString(123)',
      output: '"123"',
    },
  },
  {
    name: 'toInt',
    category: 'type',
    description: 'Convert a string to an integer (returns 0 for invalid input)',
    args: [
      {
        name: 'value',
        description: 'The string to convert',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'int',
    example: {
      input: 'toInt("123")',
      output: '123',
    },
  },
  {
    name: 'toFloat',
    category: 'type',
    description: 'Convert a string to a float (returns 0.0 for invalid input)',
    args: [
      {
        name: 'value',
        description: 'The string to convert',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'float',
    example: {
      input: 'toFloat("123.45")',
      output: '123.45',
    },
  },

  // Date/Time Functions
  {
    name: 'parseISO8601',
    category: 'datetime',
    description: 'Parse an ISO 8601 date string into a time object',
    args: [
      {
        name: 'dateString',
        description: 'The ISO 8601 date string to parse',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
    ],
    returnType: 'string', // datetime normalized to string for unified type set
    example: {
      input: 'parseISO8601("2025-10-20 08:25:44.068833")',
      output: 'time.Time object',
    },
  },
  {
    name: 'toDate',
    category: 'datetime',
    description: 'Convert a time object to a date string (YYYY-MM-DD)',
    args: [
      {
        name: 'timeValue',
        description: 'The time value to convert',
        type: 'field',
        fieldTypes: ['time.Time', 'string'],
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'toDate(parseISO8601("2025-10-20 08:25:44.068833"))',
      output: '"2025-10-20"',
    },
  },

  // Boolean Functions
  {
    name: 'contains',
    category: 'boolean',
    description: 'Check if a string contains a substring',
    args: [
      {
        name: 'value',
        description: 'The string to search in',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'substring',
        description: 'The substring to search for',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'bool',
    example: {
      input: 'contains("Mozilla/5.0", "Mozilla")',
      output: 'true',
    },
  },
  {
    name: 'hasPrefix',
    category: 'boolean',
    description: 'Check if a string starts with a prefix',
    args: [
      {
        name: 'value',
        description: 'The string to check',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'prefix',
        description: 'The prefix to check for',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'bool',
    example: {
      input: 'hasPrefix("https://example.com", "https://")',
      output: 'true',
    },
  },
  {
    name: 'hasSuffix',
    category: 'boolean',
    description: 'Check if a string ends with a suffix',
    args: [
      {
        name: 'value',
        description: 'The string to check',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'suffix',
        description: 'The suffix to check for',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'bool',
    example: {
      input: 'hasSuffix("image.png", ".png")',
      output: 'true',
    },
  },
  {
    name: 'hasKeyPrefix',
    category: 'boolean',
    description: 'Check if a parsed query object has any key with given prefixes',
    args: [
      {
        name: 'queryObject',
        description: 'The parsed query object (string in unified type set)',
        type: 'field',
        fieldTypes: ['string'],
        required: true,
      },
      {
        name: 'prefixes',
        description: 'Array of key prefixes to check',
        type: 'array',
        required: true,
      },
    ],
    returnType: 'bool',
    example: {
      input: 'hasKeyPrefix(parseQuery("ep.user_data=x&other=y"), ["ep.user_data", "ep.email"])',
      output: 'true',
    },
  },
  {
    name: 'hasAnyKey',
    category: 'boolean',
    description: 'Check if a parsed query object has any of the specified keys',
    args: [
      {
        name: 'queryObject',
        description: 'The parsed query object (string in unified type set)',
        type: 'field',
        fieldTypes: ['string'],
        required: true,
      },
      {
        name: 'keys',
        description: 'Array of keys to check',
        type: 'array',
        required: true,
      },
    ],
    returnType: 'bool',
    example: {
      input: 'hasAnyKey(parseQuery("pr1=item&other=y"), ["pr1", "ep.items"])',
      output: 'true',
    },
  },

  // Array/Object Functions
  {
    name: 'keys',
    category: 'array',
    description: 'Get all keys from a parsed query object',
    args: [
      {
        name: 'queryObject',
        description: 'The parsed query object (string in unified type set)',
        type: 'field',
        fieldTypes: ['string'],
        required: true,
      },
    ],
    returnType: 'array',
    example: {
      input: 'keys(parseQuery("a=1&b=2&c=3"))',
      output: '["a", "b", "c"]',
    },
  },
  {
    name: 'len',
    category: 'array',
    description: 'Get the length of a string, array, or object',
    args: [
      {
        name: 'value',
        description: 'The value to measure',
        type: 'field',
        fieldTypes: ['string', 'array'],
        required: true,
      },
    ],
    returnType: 'int',
    example: {
      input: 'len("hello")',
      output: '5',
    },
  },

  // Utility Functions
  {
    name: 'parseUserAgent',
    category: 'utility',
    description: 'Parse a user agent string and extract specific information',
    args: [
      {
        name: 'userAgent',
        description: 'The user agent string to parse',
        type: 'field',
        fieldTypes: STRING_TYPES,
        required: true,
      },
      {
        name: 'component',
        description: 'The component to extract (device, os, browser)',
        type: 'literal',
        literalType: 'string',
        required: true,
      },
    ],
    returnType: 'string',
    example: {
      input: 'parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0...", "device")',
      output: '"Mobile"',
    },
  },
  {
    name: 'waterfall',
    category: 'utility',
    description: 'Return the first non-empty value from an array of expressions (fields, functions, or literals)',
    args: [
      {
        name: 'expressions',
        description:
          'Array of expressions to evaluate - each can be a field reference, function call, or literal value',
        type: 'waterfall_array',
        required: true,
      },
    ],
    returnType: 'string', // Default, but can be overridden by user
    example: {
      input: "waterfall([getNestedParam(request_query, 'ep.value'), getQueryParam(request_query, 'value'), '0'])",
      output: 'First non-empty value from the expressions',
    },
  },
]

/**
 * Get functions by category
 */
export const getFunctionsByCategory = (category: FunctionCategory): TransformationFunctionDef[] => {
  return TRANSFORMATION_FUNCTIONS.filter((fn) => fn.category === category)
}

/**
 * Get all unique categories
 */
export const getCategories = (): FunctionCategory[] => {
  return [...new Set(TRANSFORMATION_FUNCTIONS.map((fn) => fn.category))]
}

/**
 * Get a function definition by name
 */
export const getFunctionByName = (name: string): TransformationFunctionDef | undefined => {
  return TRANSFORMATION_FUNCTIONS.find((fn) => fn.name === name)
}

/**
 * Category display labels
 */
export const CATEGORY_LABELS: Record<FunctionCategory, string> = {
  url: 'URL & Query',
  string: 'String',
  type: 'Type Conversion',
  datetime: 'Date & Time',
  boolean: 'Boolean',
  array: 'Array & Object',
  utility: 'Utility',
}

/**
 * Get category label
 */
export const getCategoryLabel = (category: FunctionCategory): string => {
  return CATEGORY_LABELS[category] || category
}
