#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${KAFKA_USERNAME:?Set KAFKA_USERNAME in .env or environment}"
: "${KAFKA_PASSWORD:?Set KAFKA_PASSWORD in .env or environment}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <events.ndjson> [topic-name]" >&2
  exit 1
fi

EVENT_FILE="$1"
TOPIC_NAME="${2:-login-attempts}"

if [[ ! -f "$EVENT_FILE" ]]; then
  echo "Event file not found: $EVENT_FILE" >&2
  exit 1
fi

kubectl exec -i -n kafka svc/kafka -- bash -c "
cat > /tmp/client.properties <<'EOF'
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"${KAFKA_USERNAME}\" password=\"${KAFKA_PASSWORD}\";
EOF
kafka-console-producer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --producer.config /tmp/client.properties \
  --topic \"$TOPIC_NAME\"
" < "$EVENT_FILE"

echo "Published $(wc -l < "$EVENT_FILE") events to topic '$TOPIC_NAME'."
