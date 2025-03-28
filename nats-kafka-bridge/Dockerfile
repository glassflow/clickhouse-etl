FROM golang:1.23-alpine AS build

WORKDIR /build

ADD . /build

RUN apk add make && make nats-kafka-bridge

FROM alpine:3.20

RUN apk add -U --no-cache ca-certificates tini && \
  addgroup -g 1001 nkbridge && \
  adduser -G nkbridge -h /nonexisent -s /sbin/nologin -D -H -u 1001 nkbridge

COPY --from=build /build/nats-kafka-bridge /usr/local/bin/nats-kafka-bridge

USER 1001

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/nats-kafka-bridge"]
