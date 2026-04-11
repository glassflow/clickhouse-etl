export enum SourceType {
  KAFKA = 'kafka',
  OTLP_LOGS = 'otlp.logs',
  OTLP_TRACES = 'otlp.traces',
  OTLP_METRICS = 'otlp.metrics',
}

export function isOtlpSource(sourceType: SourceType | string): boolean {
  return sourceType === SourceType.OTLP_LOGS ||
    sourceType === SourceType.OTLP_TRACES ||
    sourceType === SourceType.OTLP_METRICS
}

export function getOtlpSignalLabel(sourceType: SourceType | string): string {
  switch (sourceType) {
    case SourceType.OTLP_LOGS: return 'Logs'
    case SourceType.OTLP_TRACES: return 'Traces'
    case SourceType.OTLP_METRICS: return 'Metrics'
    default: return ''
  }
}
