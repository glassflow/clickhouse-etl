COMMIT_HASH?=$(shell git rev-parse --short HEAD)
VERSION?=$(shell git describe --tags --always --dirty)

ifneq (,$(wildcard ./.env))
include .env
$(eval export $(shell sed -ne 's/ *#.*$$//; /./ s/=.*$$// p' .env))
endif

.PHONY: run
run:
	go run cmd/glassflow/main.go

.PHONY: build
build:
	CGO_ENABLED=0 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/glassflow \
	./cmd/glassflow

.PHONY: build-linux-amd64
build-linux-amd64:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/clickhouse-etl \
	./cmd/glassflow

.PHONY: build-linux-arm64
build-linux-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -mod=readonly \
	-ldflags "-X main.version=$(VERSION)" \
	-o bin/glassflow \
	./cmd/glassflow

.PHONY: run-test
run-test:
	go test -v -count=1 -race $(shell go list ./... | grep -v /tests)

.PHONE: lint
lint:
	go run github.com/golangci/golangci-lint/v2/cmd/golangci-lint@v2.6.2 run ./...

.PHONY: pre-push-check
pre-push-check: lint run-test run-e2e-test

.PHONY: run-short-test
run-short-test:
	go test -v -short -count=1 -timeout 5m -race $(shell go list ./... | grep -v /tests)

.PHONY: run-e2e-test
run-e2e-test:
	TESTCONTAINERS_RYUK_DISABLED=true go test -v ./tests
