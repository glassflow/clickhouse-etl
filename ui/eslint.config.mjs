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
      'react/react-in-jsx-scope': 'off', // Not needed in Next.js
      'react/prop-types': 'off', // We use TypeScript for prop validation
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'off',

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': 'off', // Disable unused variables warnings
      '@typescript-eslint/no-explicit-any': 'off', // Disable the warning completely
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',

      // Next.js specific rules
      '@next/next/no-html-link-for-pages': 'off',

      // Ban hardcoded rgba() and hex colors in JSX style props and className strings.
      // All colors must use CSS tokens: var(--token-name).
      // Raw values belong only in src/themes/base.css and src/themes/theme.css.
      'no-restricted-syntax': [
        'error',
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
      ],
    },
  },
]

export default eslintConfig
