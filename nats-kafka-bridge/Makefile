APP?=nats-kafka-bridge
CI_GOLANGCI_LINT_VERSION?=v1.64.5
COMMIT_HASH?=$(shell git rev-parse --short HEAD)

ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: ci-print-lint-version
ci-print-lint-version: ## print linter version
	@ echo ${CI_GOLANGCI_LINT_VERSION}

.PHONY: ci-test
ci-test:
	bash -e -c "trap 'trap - SIGINT ERR EXIT; $(MAKE) teardown-docker-test' SIGINT ERR EXIT; \
		$(MAKE) setup-docker-test && $(MAKE) run-short-test"

.PHONY: setup-docker-test
setup-docker-test:
	docker compose -p nats_kafka_test -f resources/test_servers.yml up -d
	scripts/wait_for_containers.sh

.PHONY: teardown-docker-test
teardown-docker-test:
	docker compose -p nats_kafka_test -f resources/test_servers.yml down

.PHONY: run-test
run-test:
	bash -e -c "trap 'trap - SIGINT ERR EXIT; $(MAKE) teardown-docker-test' SIGINT ERR EXIT; \
		$(MAKE) setup-docker-test && $(MAKE) test"

.PHONY: test
test:
	go test -count=1 -timeout 5m -race ./...

.PHONY: run-short-test
run-short-test:
	# Running with -short to avoid flaky tests.
	go test -short -count=1 -timeout 5m -race ./...

.PHONY: run
run:
	go run main.go

.PHONY: build
build:
	CGO_ENABLED=0 go build -mod=readonly -o bin/nats-kafka-bridge \
	-ldflags "-X main.commit=${COMMIT_HASH} -X main.app=${APP}" \
	main.go

.PHONY: build-linux-amd64
build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=readonly -o bin/nats-kafka-bridge \
	-ldflags "-X main.commit=${COMMIT_HASH} -X main.app=${APP}" \
	main.go
