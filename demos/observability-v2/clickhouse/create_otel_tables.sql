-- OpenTelemetry Logs Table
CREATE TABLE IF NOT EXISTS otel_logs
(
    `timestamp`               DateTime64(9) CODEC(Delta, ZSTD(1)),
    `observed_timestamp`      DateTime64(9) CODEC(Delta, ZSTD(1)),
    `severity_number`         UInt8,
    `severity_text`           LowCardinality(String),
    `body`                    String CODEC(ZSTD(1)),
    `trace_id`                String CODEC(ZSTD(1)),
    `span_id`                 String CODEC(ZSTD(1)),
    `flags`                   UInt32 CODEC(ZSTD(1)),
    `dropped_attributes_count` UInt32 DEFAULT 0,
    `resource_attributes`     Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `scope_name`              LowCardinality(String) CODEC(ZSTD(1)),
    `scope_version`           String CODEC(ZSTD(1)),
    `scope_attributes`        Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `attributes`              Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    INDEX idx_trace_id trace_id TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_span_id  span_id  TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_attr_keys   mapKeys(attributes)   TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_values mapValues(attributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_body body TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (severity_text, toUnixTimestamp(timestamp))
TTL toDateTime(timestamp) + INTERVAL 30 DAY;

-- OpenTelemetry Traces Table
CREATE TABLE IF NOT EXISTS otel_traces
(
    `trace_id`                String CODEC(ZSTD(1)),
    `span_id`                 String CODEC(ZSTD(1)),
    `parent_span_id`          String CODEC(ZSTD(1)),
    `trace_state`             String CODEC(ZSTD(1)),
    `flags`                   UInt32 CODEC(ZSTD(1)),
    `name`                    LowCardinality(String) CODEC(ZSTD(1)),
    `kind`                    LowCardinality(String) CODEC(ZSTD(1)),
    `start_timestamp`         DateTime64(9) CODEC(Delta, ZSTD(1)),
    `end_timestamp`           DateTime64(9) CODEC(Delta, ZSTD(1)),
    `duration_ns`             UInt64 CODEC(ZSTD(1)),
    `status_code`             LowCardinality(String) CODEC(ZSTD(1)),
    `status_message`          String CODEC(ZSTD(1)),
    `dropped_attributes_count` Int32 DEFAULT 0,
    `dropped_events_count`    Int32 DEFAULT 0,
    `dropped_links_count`     Int32 DEFAULT 0,
    `events`                  Array(JSON),
    `links`                   Array(JSON),
    `resource_attributes`     Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `scope_name`              LowCardinality(String) CODEC(ZSTD(1)),
    `scope_version`           String CODEC(ZSTD(1)),
    `scope_attributes`        Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `attributes`              Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    INDEX idx_trace_id  trace_id  TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_span_id   span_id   TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_span_name name      TYPE bloom_filter(0.01)  GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(start_timestamp)
ORDER BY (name, toUnixTimestamp(start_timestamp), trace_id, span_id)
TTL toDateTime(start_timestamp) + INTERVAL 30 DAY;

-- OpenTelemetry Metrics Table (unified — covers Gauge, Sum, Histogram, Summary)
CREATE TABLE IF NOT EXISTS otel_metrics
(
    `timestamp`               DateTime64(9) CODEC(Delta, ZSTD(1)),
    `start_timestamp`         DateTime64(9) CODEC(Delta, ZSTD(1)),
    `metric_name`             LowCardinality(String) CODEC(ZSTD(1)),
    `metric_description`      String CODEC(ZSTD(1)),
    `metric_unit`             String CODEC(ZSTD(1)),
    `metric_type`             String CODEC(ZSTD(1)),
    `aggregation_temporality` String CODEC(ZSTD(1)),
    `is_monotonic`            Bool,
    `flags`                   UInt32 CODEC(ZSTD(1)),
    -- Scalar values (Gauge / Sum)
    `value_double`            Float64 CODEC(ZSTD(1)),
    `value_int`               Int64 CODEC(ZSTD(1)),
    -- Histogram / Summary aggregate fields
    `count`                   UInt64 CODEC(ZSTD(1)),
    `sum`                     Float64 CODEC(ZSTD(1)),
    `min`                     Float64 CODEC(ZSTD(1)),
    `max`                     Float64 CODEC(ZSTD(1)),
    `bucket_counts`           Array(UInt64),
    `explicit_bounds`         Array(Float64),
    -- Resource / scope / label maps
    `resource`                Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `scope_name`              String CODEC(ZSTD(1)),
    `scope_version`           String CODEC(ZSTD(1)),
    `scope_attributes`        Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `attributes`              Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    INDEX idx_metric_name metric_name TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_keys   mapKeys(attributes)   TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_values mapValues(attributes) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (metric_name, toUnixTimestamp(timestamp))
TTL toDateTime(timestamp) + INTERVAL 30 DAY;
