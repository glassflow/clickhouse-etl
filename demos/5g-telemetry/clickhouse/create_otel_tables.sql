-- Cleaned 5G RAN signal-quality metrics (GlassFlow dedup + normalization upstream)
CREATE TABLE IF NOT EXISTS ran_metrics
(
    `CellID` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` LowCardinality(String) CODEC(ZSTD(1)),
    `Value` Float64 CODEC(ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `NetworkMode` LowCardinality(String) CODEC(ZSTD(1)),
    `Latitude` Float64 CODEC(ZSTD(1)),
    `Longitude` Float64 CODEC(ZSTD(1)),
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    INDEX idx_cell_id CellID TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_metric_name MetricName TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree()
PARTITION BY toDate(TimeUnix)
ORDER BY (CellID, MetricName, TimeUnix);

-- ---------------------------------------------------------------------------
-- Verification: per-cell signal degradation (1-minute rolling RSRP average)
-- Flags cells below -110 dBm where 5G fallback becomes likely.
-- ---------------------------------------------------------------------------
-- SELECT
--     CellID,
--     toStartOfMinute(TimeUnix) AS minute,
--     avg(Value) AS avg_rsrp
-- FROM ran_metrics
-- WHERE MetricName = 'ran.rsrp'
-- GROUP BY CellID, minute
-- HAVING avg_rsrp < -110
-- ORDER BY minute DESC, avg_rsrp ASC
-- LIMIT 50;

-- ---------------------------------------------------------------------------
-- Verification: 95th-percentile downlink throughput per cell (5-minute window)
-- ---------------------------------------------------------------------------
-- SELECT
--     CellID,
--     quantile(0.95)(Value) AS p95_dl_kbps
-- FROM ran_metrics
-- WHERE MetricName = 'ran.dl_bitrate'
--   AND TimeUnix >= now() - INTERVAL 5 MINUTE
-- GROUP BY CellID
-- ORDER BY p95_dl_kbps DESC
-- LIMIT 20;

-- ---------------------------------------------------------------------------
-- Verification: duplicate inflation factor (run after replay with dedup OFF)
-- Compare row counts with dedup ON vs OFF for the same replay window.
-- ---------------------------------------------------------------------------
-- SELECT
--     CellID,
--     count() AS row_count,
--     count() / uniqExact(toString(TimeUnix)) AS inflation_factor
-- FROM ran_metrics
-- WHERE MetricName = 'ran.rsrp'
-- GROUP BY CellID
-- ORDER BY inflation_factor DESC
-- LIMIT 10;
