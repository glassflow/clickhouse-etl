## KAFKA -> NATS Bridge

Simple connector server based on [NATS kafka connector](https://github.com/nats-io/nats-kafka).

To run locally:
1. Copy `.env.example` to `.env` and adjust topic, subjects, streams, etc.
2. Execute `make run`
3. Observe stream via NATS CLI: `nats stream subjects <stream_name>`

