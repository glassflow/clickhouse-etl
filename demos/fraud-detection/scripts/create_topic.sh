#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

: "${KAFKA_USERNAME:?Set KAFKA_USERNAME in .env or environment}"
: "${KAFKA_PASSWORD:?Set KAFKA_PASSWORD in .env or environment}"

TOPIC_NAME="${1:-login-attempts}"

kubectl exec -n kafka svc/kafka -- bash -c "cat > /tmp/client.properties << EOF
security.protocol=SASL_PLAINTEXT
sasl.mechanism=SCRAM-SHA-256
sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"${KAFKA_USERNAME}\" password=\"${KAFKA_PASSWORD}\";
EOF
kafka-topics.sh --bootstrap-server kafka.kafka.svc.cluster.local:9092 \
  --command-config /tmp/client.properties \
  --create --if-not-exists --topic \"$TOPIC_NAME\" \
  --partitions 1 --replication-factor 1"

echo "Topic '$TOPIC_NAME' ready."
