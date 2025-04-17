#!/bin/sh

LOG_LOCATION="$(docker volume inspect -f "{{ .Mountpoint }}" clickhouse-etl-internal_logs)/app.log"

printf "Log location: %s\n\n" "$LOG_LOCATION"

cat "$LOG_LOCATION"
