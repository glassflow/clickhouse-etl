CI_GOLANGCI_LINT_VERSION?=v1.64.5
COMMIT_HASH?=$(shell git rev-parse --short HEAD)

ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: ci-print-lint-version
ci-print-lint-version: ## print linter version
	@ echo ${CI_GOLANGCI_LINT_VERSION}

.PHONY: run
run:
	go run cmd/main.go

.PHONY: build
build:
	CGO_ENABLED=0 go build -mod=readonly -o bin/clickhouse-etl \
	cmd/main.go

.PHONY: build-linux-amd64
build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=readonly -o bin/clickhouse-etl \
	cmd/main.go

.PHONY: run-test
run-test:
	go test -v -count=1 -race $(shell go list ./... | grep -v /tests)

.PHONY: run-short-test
run-short-test:
	# Running with -short to avoid flaky tests.
	go test -v -short -count=1 -timeout 5m -race $(shell go list ./... | grep -v /tests)

.PHONY: run-e2e-test
run-e2e-test:
	PATH="$(PWD)/../nats-kafka-bridge/bin:$$PATH" TESTCONTAINERS_RYUK_DISABLED=true go test -v ./tests
