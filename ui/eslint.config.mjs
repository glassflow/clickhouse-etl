import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import typescriptPlugin from '@typescript-eslint/eslint-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

// Design-system enforcement (Phase 5 of DESIGN_SYSTEM_CONSOLIDATION_PLAN.md).
// All selectors target string literals inside className attributes (which also covers
// classes passed to cn(...) calls, since the call expression is a descendant of the
// className JSXAttribute).

const internalClassNames = [
  'card-dark',
  'card-elevated',
  'card-outline',
  'btn-card',
  'btn-primary',
  'btn-text',
  'input-regular',
  'input-border-regular',
  'input-border-error',
  'modal-input-label',
  'modal-input-helper',
  'modal-input-error',
]

// Whole-class boundary: matches the class as a standalone token in a className string.
// e.g. matches "card-outline rounded-md" but NOT "card-outline-error" (state modifier — allowed)
// and NOT "var(--card-outline-border-hover)" (CSS variable — allowed).
const internalClassPattern = `(^|[\\s'\\"])(${internalClassNames.join('|')})($|[\\s'\\"])`

// Tailwind semantic-color utilities (e.g. bg-red-500, text-gray-400). Layout-only utilities
// like bg-transparent / text-current are NOT matched because they lack a numeric suffix.
const tailwindColorPattern =
  '(^|[\\s\'\\"])(bg|text|border|ring|fill|stroke|placeholder|caret|accent|decoration|divide|outline|from|via|to|hover:bg|hover:text|hover:border|focus:bg|focus:text|focus:border)-(red|gray|zinc|blue|green|yellow|orange|purple|pink|slate|amber|emerald|sky|indigo|violet|fuchsia|rose|teal|cyan|lime|stone|neutral)-[0-9]+'

// Color/value restrictions — apply everywhere except themes and Code Connect.
const colorRestrictions = [
  {
    selector:
      'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/rgba\\(/]',
    message:
      'Hardcoded rgba() in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
  },
  {
    selector:
      'JSXAttribute[name.name="style"] ObjectExpression > Property > Literal[value=/#[0-9a-fA-F]{3}/]',
    message:
      'Hardcoded hex color in style prop. Use a CSS token: style={{ color: "var(--token)" }}.',
  },
  {
    selector: 'JSXAttribute[name.name="className"] Literal[value=/rgba\\(/]',
    message:
      'Hardcoded rgba() in className. Add a CSS token to base.css/theme.css and use var(--token).',
  },
  {
    selector: `JSXAttribute[name.name="className"] Literal[value=/${tailwindColorPattern}/]`,
    message:
      'Hardcoded Tailwind color utility (e.g. text-red-500, bg-gray-100). Use a CSS token: text-[var(--color-foreground-critical)], bg-[var(--color-background-neutral-faded)] etc. Layout-only utilities (bg-transparent, text-current) are fine.',
  },
]

// Internal-class-name ban — only applies in app code, NOT in src/components/ui/** where
// primitives intentionally consume these classes internally.
const internalClassRestriction = {
  selector: `JSXAttribute[name.name="className"] Literal[value=/${internalClassPattern}/]`,
  message:
    'Internal CSS class name used directly. Use the primitive variant prop instead (<Card variant="outline">, <Button variant="primary">, <Input variant="error">, etc.). State modifiers (card-dark-error, card-outline-selected, modal-overlay, surface-gradient-border) remain allowed.',
}

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'plugin:@typescript-eslint/recommended', 'prettier'),
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      '@typescript-eslint': typescriptPlugin,
    },
    rules: {
      // React rules
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off', // Style preference (literal " in JSX text is fine).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Next.js specific rules
      '@next/next/no-html-link-for-pages': 'off',

      // Design-system: ban hardcoded colors and internal CSS class names in TSX.
      // All colors must use CSS tokens (var(--token)); visual state must come from
      // primitive variant props (<Card variant="outline">, <Button variant="primary">).
      // See docs/DESIGN_SYSTEM_CONSOLIDATION_PLAN.md Phase 5.
      'no-restricted-syntax': ['error', ...colorRestrictions, internalClassRestriction],
    },
  },
  // Exempt the primitive layer from the internal-class-name ban — these files
  // intentionally consume the class names internally (`card-outline`, `input-regular`,
  // `btn-primary`, etc.) so app code can use the variant prop API. Primitives ARE still
  // subject to the hex/rgba and Tailwind-color bans.
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...colorRestrictions],
    },
  },
  // Code Connect mapping files use Figma example syntax that may include raw values.
  // Test files (smoke tests, etc.) may use literal colors for synthetic data.
  {
    files: [
      'src/components/ui/**/*.figma.{ts,tsx}',
      'src/components/common/**/*.figma.{ts,tsx}',
      '**/__tests__/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]

export default eslintConfig
