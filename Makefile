ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: run
run:
	$(MAKE) -C glassflow-api run

.PHONY: clickhouse-etl
clickhouse-etl:
	$(MAKE) -C glassflow-api build

.PHONY: ui
ui:
	$(MAKE) -C ui build

.PHONY: build
build: clickhouse-etl ui

.PHONY: run-local
run-local: build
	docker-compose -f ./dev/docker-compose.dev.yaml up
