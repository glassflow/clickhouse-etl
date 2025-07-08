import { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_IN_DOCKER: process.env.NEXT_PUBLIC_IN_DOCKER,
    NEXT_PUBLIC_PREVIEW_MODE: process.env.NEXT_PUBLIC_PREVIEW_MODE,
  },
  redirects: async () => [
    {
      source: '/',
      destination: '/home',
      permanent: true,
    },
  ],
}

export default config
