'use client'

import { LogViewer } from '@/src/modules/pipelines/LogViewer'

export default function PipelineLogsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4 text-center">Pipeline Logs</h1>
      <LogViewer />
    </div>
  )
}
