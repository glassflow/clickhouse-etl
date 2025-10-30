import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
// Required for theme styles, previously was imported under the hood
import 'nextra-theme-docs/style.css'

import { FathomAnalytics } from './fathom'
import { ReoAnalytics } from './reodotdev'
import { Logo } from './Logo'

export const metadata = {
  // ... your metadata API
  // https://nextjs.org/docs/app/building-your-application/optimizing/metadata
}

const banner = <Banner storageKey="some-key">GlassFlow ClickHouse ETL is released 🎉</Banner>
const navbar = <Navbar logo={<Logo />} projectLink="https://github.com/glassflow/clickhouse-etl" />
const footer = (
  <Footer className="flex-col items-center md:items-start">
    {`ClickHouse ETL ${new Date().getFullYear()} © GlassFlow.`}
  </Footer>
)

export default async function RootLayout({ children }) {
  return (
    <html
      // Not required, but good for SEO
      lang="en"
      // Required to be set
      dir="ltr"
      // Suggested by `next-themes` package https://github.com/pacocoursey/next-themes#with-app
      suppressHydrationWarning
    >
      <Head
        backgroundColor={{
          dark: '#0e0e10',
          light: '#f5f5f5'
        }}
        color={{
          // use this if you want to use green color as the primary color
          // hue: { dark: 120, light: 0 },
          hue: { dark: 210, light: 210 },
          saturation: { dark: 100, light: 100 }
        }}
      >
        <link rel="icon" href="/assets/favicon.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#000000" />
      </Head>
      <body>
        <Layout
          // banner={banner}
          navbar={navbar}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/glassflow/clickhouse-etl/tree/main/docs"
          editLink="Edit this page on GitHub"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          footer={footer}
        // ...Your additional theme config options
        >
          <FathomAnalytics />
          <ReoAnalytics />
          {children}
        </Layout>
      </body>
    </html>
  )
}