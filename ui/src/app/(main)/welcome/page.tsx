import type { Metadata } from 'next'
import { MarketingLandingPage } from '@/src/components/marketing/MarketingLandingPage'

export const metadata: Metadata = {
  title: 'GlassFlow — Build pipelines from Kafka to ClickHouse',
  description:
    'Build a production-grade data pipeline from Kafka to ClickHouse in minutes with GlassFlow.',
}

// Always render the marketing page regardless of referrer or auth state.
// This route exists for direct preview access (e.g. for the glassflow.dev team).
export default function WelcomePage() {
  return <MarketingLandingPage />
}
