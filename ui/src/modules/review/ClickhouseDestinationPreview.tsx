import { filterUserMappableColumns, hasDefaultExpression } from '../clickhouse/utils'

export function ClickhouseDestinationPreview({
  clickhouseDestination,
  selectedTopics,
}: {
  clickhouseDestination: any
  selectedTopics: any
}) {
  if (!clickhouseDestination) return <div>Not configured</div>

  // Filter out MATERIALIZED and ALIAS columns from display
  const userMappableColumns = clickhouseDestination.destinationColumns
    ? filterUserMappableColumns(clickhouseDestination.destinationColumns)
    : []

  // Get actual mappable columns count (excluding MATERIALIZED/ALIAS)
  const totalMappableColumns = userMappableColumns.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Database:</div>
        <div className="text-sm text-content">{clickhouseDestination.database || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Table:</div>
        <div className="text-sm text-content">{clickhouseDestination.table || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Total Columns:</div>
        <div className="text-sm text-content">{totalMappableColumns} columns</div>

        <div className="text-sm text-muted-foreground">Mapped Fields:</div>
        <div className="text-sm text-content">{clickhouseDestination.mapping?.length || 0} fields</div>

        <div className="text-sm text-muted-foreground">Max Batch Size:</div>
        <div className="text-sm text-content">{clickhouseDestination.maxBatchSize || '1000'} rows</div>

        <div className="text-sm text-muted-foreground">Max Delay Time:</div>
        <div className="text-sm text-content">
          {clickhouseDestination.maxDelayTime || '1'} {clickhouseDestination.maxDelayTimeUnit || 'm'}
        </div>
      </div>

      {userMappableColumns.length > 0 && (
        <div className="mt-4">
          <h4 className="text-md font-medium mb-2">Field Mappings</h4>
          <div className="bg-[var(--color-background-neutral-faded)] rounded-md p-2 overflow-auto max-h-[400px]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-muted-foreground">Source Name</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Event Field</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">→</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Destination Column</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Clickhouse Type</th>
                  <th className="text-left py-2 px-3 text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {userMappableColumns.map((column: any, index: number) => {
                  const mapping = clickhouseDestination.mapping?.find((m: any) => m.name === column.name)
                  const isMapped = !!mapping?.eventField
                  const isNullable = column.type?.includes('Nullable') || column.isNullable
                  const hasDefault = hasDefaultExpression(column)

                  // Determine status
                  let status = ''
                  let statusColor = ''
                  if (!isMapped) {
                    if (hasDefault) {
                      status = 'Auto-populated'
                      statusColor = 'text-orange-500'
                    } else if (isNullable) {
                      status = 'Optional (NULL)'
                      statusColor = 'text-gray-400'
                    } else {
                      status = 'Required'
                      statusColor = 'text-red-500'
                    }
                  } else {
                    status = 'Mapped'
                    statusColor = 'text-green-500'
                  }

                  return (
                    <tr
                      key={index}
                      className={index % 2 === 0 ? 'bg-transparent' : 'bg-[var(--color-background-neutral)]'}
                    >
                      <td className="py-2 px-3 text-content">
                        {isMapped
                          ? selectedTopics.find(
                              (topic: any) =>
                                topic.events &&
                                topic.selectedEvent &&
                                topic.selectedEvent.event &&
                                mapping.eventField in topic.selectedEvent.event,
                            )?.name || 'Unknown'
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-content">{mapping?.eventField || '-'}</td>
                      <td className="py-2 px-3 text-content">{isMapped ? '→' : ''}</td>
                      <td className="py-2 px-3 text-content">{column.name}</td>
                      <td className="py-2 px-3 text-content">
                        {column.type?.replace(/Nullable\((.*)\)/, '$1') || 'Unknown'}
                      </td>
                      <td className={`py-2 px-3 text-xs font-medium ${statusColor}`}>{status}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
