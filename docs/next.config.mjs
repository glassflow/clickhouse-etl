import nextra from 'nextra'

const withNextra = nextra({
  defaultShowCopyCode: true,
  staticImage: true,
  mdxOptions: {
    rehypePlugins: [],
    remarkPlugins: []
  }
})

const nextConfig = withNextra({
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    mdxRs: true
  }
})

export default nextConfig