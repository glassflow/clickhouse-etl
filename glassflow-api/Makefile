CI_GOLANGCI_LINT_VERSION?=v1.64.5
COMMIT_HASH?=$(shell git rev-parse --short HEAD)
VERSION?=$(shell git describe --tags --always --dirty)

ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: ci-print-lint-version
ci-print-lint-version: ## print linter version
	@ echo ${CI_GOLANGCI_LINT_VERSION}

.PHONY: run
run:
	go run cmd/glassflow/main.go

.PHONY: build
build:
	CGO_ENABLED=0 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/glassflow \
	cmd/glassflow/main.go

.PHONY: build-linux-amd64
build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/clickhouse-etl \
	cmd/glassflow/main.go

.PHONY: build-linux-arm64
build-linux-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/glassflow \
	cmd/glassflow/main.go

.PHONY: run-test
run-test:
#	go test -v -count=1 -race $(shell go list ./... | grep -v /tests)
	echo "hello world"

.PHONY: run-short-test
run-short-test:
	# Running with -short to avoid flaky tests.
#	go test -v -short -count=1 -timeout 5m -race $(shell go list ./... | grep -v /tests)
	echo "hello world"

.PHONY: run-e2e-test
run-e2e-test:
#	TESTCONTAINERS_RYUK_DISABLED=true go test -v ./tests
	echo "hello world"
