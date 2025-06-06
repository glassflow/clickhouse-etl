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
    },
  },
]

export default eslintConfig
