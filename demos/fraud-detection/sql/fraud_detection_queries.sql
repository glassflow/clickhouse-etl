CREATE TABLE IF NOT EXISTS fraud_login_events
(
    event_id UUID,
    event_time DateTime,
    user_id String,
    ip_address String,
    device_id String,
    country LowCardinality(String),
    status LowCardinality(String),
    failure_reason LowCardinality(String)
)
ENGINE = MergeTree
ORDER BY (event_time, user_id, ip_address);

-- 30-second burst detection for immediate brute-force attempts.
SELECT
    toStartOfInterval(event_time, INTERVAL 30 SECOND) AS window_start,
    user_id,
    ip_address,
    count() AS failed_attempts
FROM fraud_login_events
GROUP BY window_start, user_id, ip_address
HAVING failed_attempts >= 4
ORDER BY window_start DESC, failed_attempts DESC;

-- 5-minute detection window used in the tutorial.
SELECT
    toStartOfInterval(event_time, INTERVAL 5 MINUTE) AS window_start,
    user_id,
    ip_address,
    count() AS failed_attempts,
    uniqExact(device_id) AS distinct_devices
FROM fraud_login_events
GROUP BY window_start, user_id, ip_address
HAVING failed_attempts >= 5
ORDER BY window_start DESC, failed_attempts DESC;

-- 1-hour view for slower distributed attacks against the same account.
SELECT
    toStartOfInterval(event_time, INTERVAL 1 HOUR) AS hour_start,
    user_id,
    uniqExact(ip_address) AS unique_ips,
    count() AS failed_attempts
FROM fraud_login_events
GROUP BY hour_start, user_id
HAVING failed_attempts >= 8 OR unique_ips >= 3
ORDER BY hour_start DESC, failed_attempts DESC;
