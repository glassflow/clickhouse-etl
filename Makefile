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

.PHONY: clickhouse-etl
clickhouse-etl:
	$(MAKE) -C glassflow-api build

.PHONY: build
build: nats-kafka-bridge clickhouse-etl
