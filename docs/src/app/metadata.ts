import { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    template: '%s – ClickHouse ETL',
    default: 'ClickHouse ETL Documentation'
  },
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
    // handle: '@glassflowdev',
    site: '@glassflowdev',
    // cardType: 'summary_large_image'
  }
}