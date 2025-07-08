ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: run
run: nats-kafka-bridge
	PATH="$(PWD)/nats-kafka-bridge/bin:$$PATH" $(MAKE) -C glassflow-api run

.PHONY: nats-kafka-bridge
nats-kafka-bridge:
	$(MAKE) -C nats-kafka-bridge build

.PHONY: nats-kafka-bridge-linux
nats-kafka-bridge-linux:
	$(MAKE) -C nats-kafka-bridge build-linux-amd64

.PHONY: clickhouse-etl
clickhouse-etl:
	$(MAKE) -C glassflow-api build

.PHONY: clickhouse-etl-linux
clickhouse-etl-linux:
	$(MAKE) -C glassflow-api build-linux-amd64

.PHONY: ui
ui:
	$(MAKE) -C ui build

.PHONY: build
build: nats-kafka-bridge clickhouse-etl ui

.PHONY: build-linux
build-linux: nats-kafka-bridge-linux clickhouse-etl-linux ui

.PHONY: run-local
run-local: build
	docker-compose -f ./dev/docker-compose.dev.yaml up

.PHONY: run-local-linux
run-local-linux: build-linux
	docker-compose -f ./dev/docker-compose.dev.yaml up