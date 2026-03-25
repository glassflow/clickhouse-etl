#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <events.ndjson> [topic-name]" >&2
  exit 1
fi

EVENT_FILE="$1"
TOPIC_NAME="${2:-login-attempts}"
KAFKA_NS="${KAFKA_NS:-kafka}"
KAFKA_SVC="${KAFKA_SVC:-kafka}"

if [[ ! -f "$EVENT_FILE" ]]; then
  echo "Event file not found: $EVENT_FILE" >&2
  exit 1
fi

kubectl exec -i -n "$KAFKA_NS" svc/"$KAFKA_SVC" -- \
  kafka-console-producer.sh \
    --bootstrap-server "${KAFKA_SVC}.${KAFKA_NS}.svc.cluster.local:9092" \
    --topic "$TOPIC_NAME" \
  < "$EVENT_FILE"

echo "Published $(wc -l < "$EVENT_FILE") events to topic '$TOPIC_NAME'."
