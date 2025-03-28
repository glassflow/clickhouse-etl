## Clickhouse-etl-internal

This repository houses the components required for running a complete pipeline
from Kafka to Clickhouse.

To test in development mode execute:
`make run`

Ensure any credentials required are set in `.env` file. E.g. AWS client and secret IDs for connecting with MSK Kafka.

An example [docker-compose.yaml](./docker-compose.yaml) has been added to show how this would eventually work for end-users / clients.

All functionality related to the API resides under ./glassflow-api and development related only to the API can be continued there.

All functionality related to the Kafka to Nats bridge reside under ./nats-kafka-bridge and all relaeed development can be continued there.
