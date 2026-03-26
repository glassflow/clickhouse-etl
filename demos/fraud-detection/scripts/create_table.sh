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

SQL_FILE="${SCRIPT_DIR}/../sql/fraud_detection_queries.sql"

# Extract only the CREATE TABLE statement (first statement, up to the first semicolon)
CREATE_STMT=$(sed -n '1,/;/p' "$SQL_FILE")

kubectl exec -n clickhouse svc/clickhouse -- clickhouse-client \
  --user "$CH_USER_PLAIN" \
  --password "$CH_PASS_PLAIN" \
  --query "$CREATE_STMT"

echo "Table 'fraud_login_events' ready."
