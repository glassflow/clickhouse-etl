.PHONY: run-test
run-test:
	go test -v -count=1 -race $(shell go list ./... | grep -v /tests)

.PHONY: run-short-test
run-short-test:
	# Running with -short to avoid flaky tests.
	go test -v -short -count=1 -timeout 5m -race $(shell go list ./... | grep -v /tests)

.PHONY: run-e2e-test
run-e2e-test:
	TESTCONTAINERS_RYUK_DISABLED=true go test -v ./tests
