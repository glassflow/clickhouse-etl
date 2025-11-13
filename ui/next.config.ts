import { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_USE_MOCK_API: process.env.NEXT_PUBLIC_USE_MOCK_API,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_IN_DOCKER: process.env.NEXT_PUBLIC_IN_DOCKER,
    NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE,
    NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    NEXT_PUBLIC_AUTH0_ENABLED: process.env.NEXT_PUBLIC_AUTH0_ENABLED,
    NEXT_PUBLIC_PROFILE_ROUTE: process.env.NEXT_PUBLIC_PROFILE_ROUTE,
  },
  // Redirects are now handled by middleware.ts to support optional auth
}

export default config
