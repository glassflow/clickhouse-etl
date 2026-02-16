#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env files manually (Node.js doesn't load them automatically)
const loadEnvFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    content.split('\n').forEach((line) => {
      // Skip comments and empty lines
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) return

      // Parse key=value pairs
      const match = trimmedLine.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove surrounding quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        // Only set if not already defined (allows system env vars to override)
        if (process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    })
  }
}

// Load env files in order of precedence (later files override earlier ones for undefined vars)
loadEnvFile(path.join(__dirname, '.env'))
loadEnvFile(path.join(__dirname, '.env.local'))

// Set default values for environment variables
const envVars = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  NEXT_PUBLIC_IN_DOCKER: process.env.NEXT_PUBLIC_IN_DOCKER || 'false',
  NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE || 'false',
  NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API || 'false',
  NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED || 'true',
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'false',
  NEXT_PUBLIC_DASHBOARD: process.env.NEXT_PUBLIC_DASHBOARD || '',
  NEXT_PUBLIC_AUTH0_ENABLED: process.env.NEXT_PUBLIC_AUTH0_ENABLED || 'false',
  NEXT_PUBLIC_PROFILE_ROUTE: process.env.NEXT_PUBLIC_PROFILE_ROUTE || '/api/auth/me',
  // OpenTelemetry Configuration
  NEXT_PUBLIC_OTEL_LOGS_ENABLED: process.env.NEXT_PUBLIC_OTEL_LOGS_ENABLED || 'false',
  NEXT_PUBLIC_OTEL_METRICS_ENABLED: process.env.NEXT_PUBLIC_OTEL_METRICS_ENABLED || 'false',
  NEXT_PUBLIC_OTEL_SERVICE_NAME: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME || 'glassflow-ui',
  NEXT_PUBLIC_OTEL_SERVICE_VERSION: process.env.NEXT_PUBLIC_OTEL_SERVICE_VERSION || 'dev',
  NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE || '',
  NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID: process.env.NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID || '',
  NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT:
    process.env.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
  NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
  NEXT_PUBLIC_FILTERS_ENABLED: process.env.NEXT_PUBLIC_FILTERS_ENABLED || 'true',
  NEXT_PUBLIC_TRANSFORMATIONS_ENABLED: process.env.NEXT_PUBLIC_TRANSFORMATIONS_ENABLED || 'true',
  NEXT_PUBLIC_NOTIFICATIONS_ENABLED: process.env.NEXT_PUBLIC_NOTIFICATIONS_ENABLED || 'false',
}

// Generate the env.js content
const envJsContent = `window.__ENV__ = {
  NEXT_PUBLIC_API_URL: "${envVars.NEXT_PUBLIC_API_URL}",
  NEXT_PUBLIC_IN_DOCKER: "${envVars.NEXT_PUBLIC_IN_DOCKER}",
  NEXT_PUBLIC_PREVIEW_MODE: "${envVars.NEXT_PUBLIC_PREVIEW_MODE}",
  NEXT_PUBLIC_USE_MOCK_API: "${envVars.NEXT_PUBLIC_USE_MOCK_API}",
  NEXT_PUBLIC_ANALYTICS_ENABLED: "${envVars.NEXT_PUBLIC_ANALYTICS_ENABLED}",
  NEXT_PUBLIC_DEMO_MODE: "${envVars.NEXT_PUBLIC_DEMO_MODE}",
  NEXT_PUBLIC_DASHBOARD: "${envVars.NEXT_PUBLIC_DASHBOARD}",
  NEXT_PUBLIC_AUTH0_ENABLED: "${envVars.NEXT_PUBLIC_AUTH0_ENABLED}",
  NEXT_PUBLIC_PROFILE_ROUTE: "${envVars.NEXT_PUBLIC_PROFILE_ROUTE}",
  NEXT_PUBLIC_OTEL_LOGS_ENABLED: "${envVars.NEXT_PUBLIC_OTEL_LOGS_ENABLED}",
  NEXT_PUBLIC_OTEL_METRICS_ENABLED: "${envVars.NEXT_PUBLIC_OTEL_METRICS_ENABLED}",
  NEXT_PUBLIC_OTEL_SERVICE_NAME: "${envVars.NEXT_PUBLIC_OTEL_SERVICE_NAME}",
  NEXT_PUBLIC_OTEL_SERVICE_VERSION: "${envVars.NEXT_PUBLIC_OTEL_SERVICE_VERSION}",
  NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE: "${envVars.NEXT_PUBLIC_OTEL_SERVICE_NAMESPACE}",
  NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID: "${envVars.NEXT_PUBLIC_OTEL_SERVICE_INSTANCE_ID}",
  NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT: "${envVars.NEXT_PUBLIC_OTEL_EXPORTER_OTLP_ENDPOINT}",
  NEXT_PUBLIC_LOG_LEVEL: "${envVars.NEXT_PUBLIC_LOG_LEVEL}",
  NEXT_PUBLIC_FILTERS_ENABLED: "${envVars.NEXT_PUBLIC_FILTERS_ENABLED}",
  NEXT_PUBLIC_TRANSFORMATIONS_ENABLED: "${envVars.NEXT_PUBLIC_TRANSFORMATIONS_ENABLED}",
  NEXT_PUBLIC_NOTIFICATIONS_ENABLED: "${envVars.NEXT_PUBLIC_NOTIFICATIONS_ENABLED}"
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
