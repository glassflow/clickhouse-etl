import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const projectRoot = path.resolve(__dirname)

export default defineConfig({
  plugins: [react()],
  // Root set to src/ so Vite does not discover postcss.config.mjs in project root (string plugins break Vite)
  root: path.join(projectRoot, 'src'),
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['test/setupTests.ts'],
    include: [
      'test/**/*.{test,spec}.{ts,tsx}',
      'app/**/*.{test,spec}.{ts,tsx}',
      'hooks/**/*.{test,spec}.{ts,tsx}',
      'modules/create/**/*.{test,spec}.{ts,tsx}',
      'modules/kafka/**/*.{test,spec}.{ts,tsx}',
      'modules/deduplication/**/*.{test,spec}.{ts,tsx}',
      'modules/join/**/*.{test,spec}.{ts,tsx}',
      'modules/pipeline-adapters/**/*.{test,spec}.{ts,tsx}',
      'modules/pipelines/**/*.{test,spec}.{ts,tsx}',
      'store/**/*.{test,spec}.{ts,tsx}',
      'utils/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', '.next'],
  },
  resolve: {
    alias: {
      '@': projectRoot,
    },
  },
})
