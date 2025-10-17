#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Set default values for environment variables
const envVars = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  NEXT_PUBLIC_IN_DOCKER: process.env.NEXT_PUBLIC_IN_DOCKER || 'false',
  NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE || 'false',
  NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API || 'false',
  NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED || 'true',
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'false',
}

// Generate the env.js content
const envJsContent = `window.__ENV__ = {
  NEXT_PUBLIC_API_URL: "${envVars.NEXT_PUBLIC_API_URL}",
  NEXT_PUBLIC_IN_DOCKER: "${envVars.NEXT_PUBLIC_IN_DOCKER}",
  NEXT_PUBLIC_PREVIEW_MODE: "${envVars.NEXT_PUBLIC_PREVIEW_MODE}",
  NEXT_PUBLIC_USE_MOCK_API: "${envVars.NEXT_PUBLIC_USE_MOCK_API}",
  NEXT_PUBLIC_ANALYTICS_ENABLED: "${envVars.NEXT_PUBLIC_ANALYTICS_ENABLED}",
  NEXT_PUBLIC_DEMO_MODE: "${envVars.NEXT_PUBLIC_DEMO_MODE}"
};`

// Ensure public directory exists
const publicDir = path.join(__dirname, 'public')
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true })
}

// Write the env.js file
const envJsPath = path.join(publicDir, 'env.js')
fs.writeFileSync(envJsPath, envJsContent)

// console.log('✅ Generated env.js with environment variables:')
// console.log(JSON.stringify(envVars, null, 2))
// console.log(`📁 Written to: ${envJsPath}`)
