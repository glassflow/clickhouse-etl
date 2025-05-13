import React from 'react'

const config = {
    logo: <span>ClickHouse ETL Documentation</span>,
    project: {
        link: 'https://github.com/glassflow/clickhouse-project'
    },
    docsRepositoryBase: 'https://github.com/glassflow/clickhouse-project/tree/main/docs',
    footer: {
        text: `ClickHouse ETL ${new Date().getFullYear()} © GlassFlow.`
    },
    useNextSeoProps() {
        return {
            titleTemplate: '%s – ClickHouse ETL'
        }
    }
}

export default config 