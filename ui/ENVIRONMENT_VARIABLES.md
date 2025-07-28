# Environment Variables Configuration

This document explains how environment variables work in the GlassFlow UI application and how to configure them for different environments.

## Overview

The application supports two types of environment variables:

1. **Build-time variables** (`.env.local`, `.env`) - Used during development and build
2. **Runtime variables** (Docker environment) - Used in production containers

## Environment Variable Priority

The application uses the following priority order for environment variables:

1. **Runtime environment** (`window.__ENV__`) - Docker overrides (highest priority)
2. **Build-time environment** (`process.env`) - `.env.local`, `.env`, system variables
3. **Default values** - Fallback values (lowest priority)

## Available Environment Variables

### `NEXT_PUBLIC_API_URL`

- **Description**: URL for the backend API
- **Default**: `http://app:8080/api/v1`
- **Usage**: Used for all API calls to the backend

### `NEXT_PUBLIC_IN_DOCKER`

- **Description**: Whether the application is running in Docker
- **Default**: `true`
- **Usage**: Affects Kafka connection handling (localhost vs host.docker.internal)

### `NEXT_PUBLIC_PREVIEW_MODE`

- **Description**: Enables/disables the preview step in pipeline creation
- **Default**: `false`
- **Usage**: When `true`, shows ReviewConfiguration step; when `false`, goes directly to pipelines

## Development Setup

### Using `.env.local` for Development

Create a `.env.local` file in the `clickhouse-etl/ui/` directory:

```bash
# Development API URL (local backend)
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1

# Not running in Docker
NEXT_PUBLIC_IN_DOCKER=false

# Enable preview mode for development
NEXT_PUBLIC_PREVIEW_MODE=true
```

### Development Commands

```bash
# Start development server with .env.local
pnpm dev

# Build for production (uses .env.local if available)
pnpm build

# Start production server
pnpm start
```

## Docker Setup

### Docker Compose Configuration

The application is configured to use Docker environment variables:

```yaml
services:
  ui:
    environment:
      - NEXT_PUBLIC_API_URL=http://app:8080/api/v1
      - NEXT_PUBLIC_IN_DOCKER=true
      - NEXT_PUBLIC_PREVIEW_MODE=false
```

### Docker Build

```bash
# Build with custom environment variables
docker build \
  --build-arg NEXT_PUBLIC_API_URL=http://app:8080/api/v1 \
  --build-arg NEXT_PUBLIC_IN_DOCKER=true \
  --build-arg NEXT_PUBLIC_PREVIEW_MODE=false \
  -t glassflow/clickhouse-etl-fe:latest .
```

## Runtime Configuration

The application generates runtime configuration files:

- **Client-side**: `/public/env.js` - Available as `window.__ENV__`
- **Server-side**: `/.next/server/app/api/config.js` - For API routes

## Debugging Environment Variables

### Development Debug Component

In development mode, a debug component is automatically included that shows:

- Current environment variable values
- Runtime vs build-time values
- Detailed console logging

### Manual Debugging

You can use the debug utility in your code:

```typescript
import { debugEnvVars } from '@/src/utils/env'

// Log all environment variables
debugEnvVars()
```

### Console Debugging

Check the browser console for detailed environment variable information:

- Runtime environment variables (`window.__ENV__`)
- Build-time environment variables (`process.env`)
- Resolved values from the env utilities

## Common Issues and Solutions

### Issue: `.env.local` values not being used

**Cause**: Docker environment variables take precedence over `.env.local`

**Solution**:

- For development: Use `pnpm dev` instead of Docker
- For Docker: Set environment variables in docker-compose.yml

### Issue: Environment variables not available in browser

**Cause**: Variables not properly exposed in `next.config.ts`

**Solution**: Ensure all variables are listed in the `env` section of `next.config.ts`

### Issue: API calls failing in Docker

**Cause**: Wrong API URL or Docker networking issues

**Solution**:

- Check `NEXT_PUBLIC_API_URL` is correct for Docker network
- Ensure `NEXT_PUBLIC_IN_DOCKER=true` for proper host resolution

## Best Practices

1. **Use `.env.local` for development** - Never commit this file
2. **Use Docker environment variables for production** - Ensures consistency
3. **Always use the env utilities** - Don't access `process.env` directly
4. **Test both development and production configurations** - Ensure compatibility
5. **Use the debug component** - Verify environment variables are working correctly

## File Structure

```
clickhouse-etl/ui/
├── .env.local              # Development environment variables (gitignored)
├── .env                    # Default environment variables
├── next.config.ts          # Next.js configuration with env exposure
├── startup.sh              # Docker runtime configuration
├── src/utils/env.ts        # Environment variable utilities
└── src/components/debug/   # Debug components
    └── EnvDebug.tsx        # Development debug component
```
