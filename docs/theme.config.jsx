import React, { useState, useEffect } from 'react'
import { useTheme } from 'nextra-theme-docs'

const Logo = () => {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR and initial render, use the default logo
  if (!mounted) {
    return (
      <img
        src="/assets/logo.svg"
        alt="GlassFlow Logo"
        style={{ height: '18px' }}
      />
    )
  }

  return (
    <img
      src={resolvedTheme === 'dark' ? '/assets/logo.svg' : '/assets/logo-black.svg'}
      alt="GlassFlow Logo"
      style={{ height: '18px' }}
    />
  )
}

const config = {
  logo: <Logo />,
  project: {
    link: 'https://github.com/glassflow/clickhouse-etl'
  },
  docsRepositoryBase: 'https://github.com/glassflow/clickhouse-etl/tree/main/docs',
  footer: {
    text: `ClickHouse ETL ${new Date().getFullYear()} © GlassFlow.`
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s – ClickHouse ETL',
      defaultTitle: 'ClickHouse ETL Documentation',
      description: 'Documentation for GlassFlow ClickHouse ETL - Real-time stream processor for Kafka to ClickHouse data pipelines',
      openGraph: {
        type: 'website',
        locale: 'en_US',
        url: 'https://glassflow.dev',
        siteName: 'GlassFlow ClickHouse ETL',
        images: [
          {
            url: '/assets/logo.svg',
            width: 1200,
            height: 630,
            alt: 'GlassFlow ClickHouse ETL'
          }
        ]
      },
      twitter: {
        handle: '@glassflowdev',
        site: '@glassflowdev',
        cardType: 'summary_large_image'
      }
    }
  },
  head: (
    <>
      <link rel="icon" href="/assets/favicon.png" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="theme-color" content="#000000" />
    </>
  )
}

export default config 