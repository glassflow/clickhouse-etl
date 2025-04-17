#!/bin/sh

# NOTE: hack to not have to find volume for the project always
VOLUME="$(docker compose config | grep _logs | rev | cut -d' ' -f1 | rev)"
LOG_LOCATION="$(docker volume inspect -f "{{ .Mountpoint }}" "$VOLUME")"

printf "Log location: %s\n\n" "$LOG_LOCATION"

cat "$LOG_LOCATION/$(ls "$LOG_LOCATION" | tail -n 1)"
