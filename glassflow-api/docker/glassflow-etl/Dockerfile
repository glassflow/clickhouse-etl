FROM alpine:3.20

RUN apk add -U --no-cache ca-certificates tini && \
  addgroup -g 1001 etl && \
  adduser -G etl -h /nonexisent -s /sbin/nologin -D -H -u 1001 etl

COPY ./nats-kafka-bridge/bin/nats-kafka-bridge /usr/local/bin/nats-kafka-bridge
COPY ./glassflow-api/bin/clickhouse-etl /usr/local/bin/clickhouse-etl

RUN mkdir -p /tmp/logs/glassflow && chown 1001:1001 /tmp/logs/glassflow

USER 1001

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/clickhouse-etl"]
