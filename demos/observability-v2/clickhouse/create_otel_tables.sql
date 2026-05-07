-- OpenTelemetry Traces (ClickStack-compatible OTLP traces table)
CREATE TABLE IF NOT EXISTS otel_traces
(
    `Timestamp` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TraceId` String CODEC(ZSTD(1)),
    `SpanId` String CODEC(ZSTD(1)),
    `ParentSpanId` String CODEC(ZSTD(1)),
    `TraceState` String CODEC(ZSTD(1)),
    `SpanName` LowCardinality(String) CODEC(ZSTD(1)),
    `SpanKind` LowCardinality(String) CODEC(ZSTD(1)),
    `ResourceAttributes` Map(String, String) CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) DEFAULT ResourceAttributes['service.name'] CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `SpanAttributes` Map(String, String) CODEC(ZSTD(1)),
    `Duration` UInt64 CODEC(ZSTD(1)),
    `StatusCode` LowCardinality(String) CODEC(ZSTD(1)),
    `StatusMessage` String CODEC(ZSTD(1)),
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_span_id SpanId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_parent_span_id ParentSpanId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_service_name ServiceName TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_name SpanName TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_kind SpanKind TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_status_code StatusCode TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_key mapKeys(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key mapKeys(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value mapValues(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toDate(Timestamp)
ORDER BY (ServiceName, Timestamp, TraceId, SpanId);

ALTER TABLE otel_traces
    MODIFY COLUMN `ServiceName` LowCardinality(String)
    DEFAULT ResourceAttributes['service.name']
    CODEC(ZSTD(1));

ALTER TABLE otel_traces
    DROP COLUMN IF EXISTS `Events.Timestamp`,
    DROP COLUMN IF EXISTS `Events.Name`,
    DROP COLUMN IF EXISTS `Events.Attributes`,
    DROP COLUMN IF EXISTS `Links.TraceId`,
    DROP COLUMN IF EXISTS `Links.SpanId`,
    DROP COLUMN IF EXISTS `Links.TraceState`,
    DROP COLUMN IF EXISTS `Links.Attributes`,
    DROP COLUMN IF EXISTS `Events`,
    DROP COLUMN IF EXISTS `Links`;

ALTER TABLE otel_traces
    MODIFY COLUMN `ResourceAttributes` Map(String, String) CODEC(ZSTD(1)),
    MODIFY COLUMN `SpanAttributes` Map(String, String) CODEC(ZSTD(1));
