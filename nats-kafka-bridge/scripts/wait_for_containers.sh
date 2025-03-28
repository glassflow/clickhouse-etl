#!/bin/bash
# wait_for_containers.sh
set -e

# Max query attempts before consider setup failed
MAX_TRIES=5

# Return true-like values if and only if logs
# contain the expected "ready" line
function kafkaIsReady() {
  docker compose -p nats_kafka_test -f resources/test_servers.yml logs kafka | grep "started (kafka.server.KafkaServer)"
}

function zookeeper() {
  docker compose -p nats_kafka_test -f resources/test_servers.yml logs zookeeper | grep "binding to port 0.0.0.0/0.0.0.0:2181"
}

function waitUntilServiceIsReady() {
  attempt=1
  while [ $attempt -le $MAX_TRIES ]; do
    if "$@"; then
      echo "$2 container is up!"
      break
    fi
    echo "Waiting for $2 container... (attempt: $((attempt++)))"
    sleep 5
  done

  if [ $attempt -gt $MAX_TRIES ]; then
    echo "Error: $2 not responding, canceling set up"
    exit 1
  fi
}

waitUntilServiceIsReady zookeeper "zookeeper"
waitUntilServiceIsReady kafkaIsReady "kafka"
