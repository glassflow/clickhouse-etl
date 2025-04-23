## Clickhouse-etl-internal

This repository houses the components required for running a complete pipeline
from Kafka to Clickhouse including the UI support and Demos.

To test the api in development mode execute:
`make run`

All functionality related to the main API resides under [glassflow-api](./glassflow-api) and development related only to the API can be continued there.

All functionality related to the Kafka to Nats bridge reside under [nats-kafka-bridge](./nats-kafka-bridge) and all related development can be continued there.
