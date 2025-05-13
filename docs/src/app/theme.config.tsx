import { useThemeConfig } from 'nextra-theme-docs'

const config = {
  logo: <span>ClickHouse ETL</span>,
  project: {
    link: 'https://github.com/glassflow/clickhouse-etl'
  },
  docsRepositoryBase: 'https://github.com/glassflow/clickhouse-etl/tree/main/docs',
  footer: {
    text: `ClickHouse ETL ${new Date().getFullYear()} © GlassFlow.`
  }
}

export default config 