#!/usr/bin/env bash
set -euo pipefail

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
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required username=\"user1\" password=\"glassflow-demo-password\";
EOF
kafka-console-producer.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --producer.config /tmp/client.properties \
  --topic \"$TOPIC_NAME\"
" < "$EVENT_FILE"

echo "Published $(wc -l < "$EVENT_FILE") events to topic '$TOPIC_NAME'."
