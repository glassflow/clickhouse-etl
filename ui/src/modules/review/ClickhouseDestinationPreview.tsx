export function ClickhouseDestinationPreview({
  clickhouseDestination,
  selectedTopics,
}: {
  clickhouseDestination: any
  selectedTopics: any
}) {
  if (!clickhouseDestination) return <div>Not configured</div>

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">Database:</div>
        <div className="text-sm text-content">{clickhouseDestination.database || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Table:</div>
        <div className="text-sm text-content">{clickhouseDestination.table || 'Not configured'}</div>

        <div className="text-sm text-muted-foreground">Total Columns:</div>
        <div className="text-sm text-content">{clickhouseDestination.destinationColumns?.length || 0} columns</div>

        <div className="text-sm text-muted-foreground">Mapped Fields:</div>
        <div className="text-sm text-content">{clickhouseDestination.mapping?.length || 0} fields</div>

        <div className="text-sm text-muted-foreground">Max Batch Size:</div>
        <div className="text-sm text-content">{clickhouseDestination.maxBatchSize || '1000'} rows</div>

        <div className="text-sm text-muted-foreground">Max Delay Time:</div>
        <div className="text-sm text-content">
          {clickhouseDestination.maxDelayTime || '1'} {clickhouseDestination.maxDelayTimeUnit || 'm'}
        </div>
      </div>

      {clickhouseDestination.mapping && clickhouseDestination.mapping.length > 0 && (
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
                </tr>
              </thead>
              <tbody>
                {clickhouseDestination.mapping.map((mapping: any, index: number) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? 'bg-transparent' : 'bg-[var(--color-background-neutral)]'}
                  >
                    <td className="py-2 px-3 text-content">
                      {selectedTopics.find(
                        (topic: any) =>
                          topic.events &&
                          topic.selectedEvent &&
                          topic.selectedEvent.event &&
                          mapping.eventField in topic.selectedEvent.event,
                      )?.name || 'Unknown'}
                    </td>
                    <td className="py-2 px-3 text-content">{mapping.eventField || 'Not mapped'}</td>
                    <td className="py-2 px-3 text-content">→</td>
                    <td className="py-2 px-3 text-content">{mapping.name}</td>
                    <td className="py-2 px-3 text-content">{mapping.type.replace(/Nullable\((.*)\)/, '$1')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
