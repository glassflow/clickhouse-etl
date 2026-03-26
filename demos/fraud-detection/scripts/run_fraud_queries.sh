#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${CLICKHOUSE_USER:?Set CLICKHOUSE_USER in .env or environment}"
: "${CLICKHOUSE_PASSWORD:?Set CLICKHOUSE_PASSWORD in .env or environment}"

CH_USER_PLAIN=$(echo "$CLICKHOUSE_USER" | base64 -d)
CH_PASS_PLAIN=$(echo "$CLICKHOUSE_PASSWORD" | base64 -d)

echo "=== 5-minute window: suspicious login activity ==="
kubectl exec -n clickhouse svc/clickhouse -- clickhouse-client \
  --user "$CH_USER_PLAIN" \
  --password "$CH_PASS_PLAIN" \
  --query "
SELECT
    toStartOfInterval(event_time, INTERVAL 5 MINUTE) AS window_start,
    user_id,
    ip_address,
    count() AS failed_attempts,
    uniqExact(device_id) AS distinct_devices
FROM fraud_login_events
GROUP BY window_start, user_id, ip_address
HAVING failed_attempts >= 5
ORDER BY window_start DESC, failed_attempts DESC
FORMAT Vertical"
