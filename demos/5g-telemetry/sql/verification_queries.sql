# Row counts by metric (health-check metrics should be absent)
SELECT MetricName, count() AS rows
FROM ran_metrics
GROUP BY MetricName
ORDER BY rows DESC;

-- Signal degradation: cells with 1-minute RSRP average below -110 dBm
SELECT
    CellID,
    toStartOfMinute(TimeUnix) AS minute,
    avg(Value) AS avg_rsrp
FROM ran_metrics
WHERE MetricName = 'ran.rsrp'
GROUP BY CellID, minute
HAVING avg_rsrp < -110
ORDER BY minute DESC, avg_rsrp ASC
LIMIT 50;

-- Throughput SLA: 95th-percentile downlink bitrate per cell
SELECT
    CellID,
    quantile(0.95)(Value) AS p95_dl_kbps
FROM ran_metrics
WHERE MetricName = 'ran.dl_bitrate'
GROUP BY CellID
ORDER BY p95_dl_kbps DESC
LIMIT 20;

-- Duplicate inflation factor (compare after dedup OFF replay).
-- Each observation carries a stable measurement_id shared by both HA collectors.
-- Dedup ON  -> count() == unique_measurements, inflation_factor ~ 1.0
-- Dedup OFF -> both collector copies persist, inflation_factor ~ 2.0
SELECT
    CellID,
    count() AS row_count,
    uniqExact(Attributes['measurement_id']) AS unique_measurements,
    count() / greatest(uniqExact(Attributes['measurement_id']), 1) AS inflation_factor
FROM ran_metrics
WHERE MetricName = 'ran.rsrp'
GROUP BY CellID
ORDER BY inflation_factor DESC
LIMIT 10;
