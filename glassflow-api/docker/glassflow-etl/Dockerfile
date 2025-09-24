FROM debian:12-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        tini \
        librdkafka1 \
        libssl3 \
        libsasl2-2 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 glassflow && \
    useradd -r -g glassflow -u 1001 -s /sbin/nologin glassflow

COPY ./glassflow-api/bin/glassflow /usr/local/bin/glassflow

RUN mkdir -p /tmp/logs/glassflow && chown 1001:1001 /tmp/logs/glassflow

USER 1001

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/glassflow"]