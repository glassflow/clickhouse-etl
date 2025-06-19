FROM alpine:3.20

RUN apk add -U --no-cache ca-certificates tini && \
    addgroup -g 1001 glassflow && \
    adduser -G glassflow -h /nonexistent -s /sbin/nologin -D -H -u 1001 glassflow

COPY bin/glassflow-join /usr/local/bin/glassflow-join

RUN mkdir -p /tmp/logs/glassflow && chown 1001:1001 /tmp/logs/glassflow

USER 1001

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/glassflow-join"]