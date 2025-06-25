ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: run
run: nats-kafka-bridge
	PATH="$(PWD)/nats-kafka-bridge/bin:$$PATH" $(MAKE) -C glassflow-api run

.PHONY: nats-kafka-bridge
nats-kafka-bridge:
	$(MAKE) -C nats-kafka-bridge build-linux-amd64

.PHONY: clickhouse-etl
clickhouse-etl:
	$(MAKE) -C glassflow-api build-linux-amd64

.PHONY: ui
ui:
	$(MAKE) -C ui build

.PHONY: build
build: nats-kafka-bridge clickhouse-etl ui

.PHONY: run-local
run-local: build
	docker compose -f ./dev/docker-compose.dev.yaml up
