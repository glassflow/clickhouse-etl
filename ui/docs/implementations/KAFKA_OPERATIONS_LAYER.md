# Kafka Operations Layer

## Overview

This document describes the Kafka operations layer used by the UI: the stack from API routes down to the actual Kafka clients. It covers the **service layer** (KafkaService), **factory** (KafkaClientFactory), **client implementations** (KafkaClient / KafkaGatewayClient), **resilience patterns** (circuit breaker, retry, AbortSignal), and **testing**. For UI-facing flows (connection form, topic selection, type verification), see [KAFKA_CONNECTION.md](../modules/kafka/KAFKA_CONNECTION.md), [KAFKA_TOPIC_SELECTION.md](../modules/kafka/KAFKA_TOPIC_SELECTION.md), and [KAFKA_TYPE_VERIFICATION.md](../modules/kafka/KAFKA_TYPE_VERIFICATION.md). For Kerberos and the Go gateway, see [KERBEROS_IMPLEMENTATION_SUMMARY.md](./KERBEROS_IMPLEMENTATION_SUMMARY.md).

## Architecture

```
UI / API routes (POST /ui-api/kafka/, /ui-api/kafka/topics, /ui-api/kafka/events, etc.)
    ↓
KafkaApiClient (services/kafka-api-client.ts)
    - Builds request from KafkaStore
    - Calls KafkaService for test, topics, topic-details, events
    ↓
KafkaService (services/kafka-service.ts)
    - AbortController + timeout for each operation
    - Always disconnects client in finally
    - Structured responses (success, abort, circuit breaker, topic boundaries)
    ↓
KafkaClientFactory (lib/kafka-client-factory.ts)
    - SASL/GSSAPI → KafkaGatewayClient
    - All other auth → KafkaClient (KafkaJS)
    ↓
KafkaClient (KafkaJS)          KafkaGatewayClient (Go gateway over HTTP)
    - Circuit breaker              - Retry with backoff
    - Retry with backoff            - AbortSignal propagation
    - Consumer tracker              - Typed FetchSampleEventOptions
```

## Roles

### KafkaApiClient

- **Location:** `src/services/kafka-api-client.ts`
- **Role:** Builds request payload from `KafkaStore` (auth method, certificates, etc.) and calls the internal Kafka service. Used by hooks and API route handlers. Does not hold connection state; each operation gets a fresh client via the factory.

### KafkaService

- **Location:** `src/services/kafka-service.ts`
- **Role:** Orchestrates timeouts and cleanup for all Kafka operations. For each call it: creates a client via `createKafkaClient(config)`, sets an `AbortController` with a timeout (e.g. 30s for API, 15s for connection test), passes the abort signal to the client where supported, and **always** disconnects the client in a `finally` block. For `fetchEvent`, it normalizes responses (success, timeout/abort, circuit breaker open, end/beginning/empty topic) into a single structured shape.

### KafkaClientFactory

- **Location:** `src/lib/kafka-client-factory.ts`
- **Role:** Single place that decides which client to use. `authMethod === 'SASL/GSSAPI'` → `KafkaGatewayClient`; otherwise → KafkaJS client (lazy-loaded from `kafka-client.ts`). Exposes `createKafkaClient(config)` and helpers like `getSupportedAuthMethods()`.

### KafkaClient (KafkaJS)

- **Location:** `src/lib/kafka-client.ts`
- **Role:** Implements `IKafkaClient` using the KafkaJS library. Used for all non-Kerberos auth. Includes **circuit breaker** (CLOSED/OPEN/HALF_OPEN), **retry with exponential backoff** for transient failures, and **consumer tracker** for orphaned consumer cleanup. Supports optional `AbortSignal` on `listTopics`, `getTopicDetails`, `testConnection`, and `fetchSampleEvent` options.

### KafkaGatewayClient

- **Location:** `src/lib/kafka-gateway-client.ts`
- **Role:** Implements `IKafkaClient` by calling the Go-based Kafka Kerberos Gateway over HTTP. Used only for SASL/GSSAPI. **Retry:** configurable retry for transient HTTP errors (e.g. ECONNREFUSED, ETIMEDOUT) with exponential backoff. **AbortSignal:** `callGateway` accepts an optional external `AbortSignal` and combines it with the default timeout via `combineAbortSignals()`. Typed `FetchSampleEventOptions` (position, direction, partition, abortSignal).

### Interface and config

- **Location:** `src/lib/kafka-client-interface.ts`
- **Role:** `IKafkaClient` defines the contract. `KafkaConfig` is the single source of truth for connection config (brokers, auth fields, truststore, etc.); clients and factory use this interface only.

## Resilience

| Layer        | Pattern              | Behavior |
|-------------|----------------------|-----------|
| KafkaService| Timeout + cleanup     | AbortController per operation; disconnect in `finally` so no leaked connections. |
| KafkaClient (KafkaJS) | Circuit breaker | Reduces repeated failures when broker is down; state machine CLOSED → OPEN → HALF_OPEN. |
| KafkaClient (KafkaJS) | Retry with backoff | Configurable retries for transient errors before failing. |
| KafkaClient (KafkaJS) | Consumer tracker | Cleans up orphaned consumers; periodic GC. |
| KafkaGatewayClient   | Retry with backoff | Transient HTTP errors retried with configurable max retries and backoff. |
| KafkaGatewayClient   | AbortSignal        | External cancellation and internal timeout combined; long or cancelled requests abort cleanly. |

Changing client selection (factory) or the gateway contract (request/response shape, timeouts) can break Kerberos flows and timeout behavior. When touching this layer, run the tests in `lib/__tests__/` and `services/__tests__/`.

## File Structure

```
src/lib/
├── kafka-client-interface.ts   # IKafkaClient, KafkaConfig, error types
├── kafka-client-factory.ts      # createKafkaClient, client type selection
├── kafka-gateway-client.ts      # Gateway client (retry, AbortSignal)
├── kafka-client.ts              # KafkaJS client (circuit breaker, retry, consumer tracker)
└── __tests__/
    ├── circuit-breaker.test.ts
    ├── consumer-tracker.test.ts
    ├── kafka-client-factory.test.ts
    ├── kafka-gateway-client.test.ts
    └── retry-logic.test.ts

src/services/
├── kafka-api-client.ts          # Builds requests from store; calls KafkaService
├── kafka-service.ts             # Timeouts, cleanup, structured fetchEvent response
└── __tests__/
    └── kafka-service.test.ts
```

## Testing

Tests live under `src/lib/__tests__/` and `src/services/__tests__/`. They are the source of truth for behavior when changing this layer.

| Test file                   | What it covers |
|----------------------------|----------------|
| `circuit-breaker.test.ts`  | Circuit breaker state transitions (CLOSED, OPEN, HALF_OPEN) and behavior. |
| `retry-logic.test.ts`      | Retry with backoff and abort handling. |
| `consumer-tracker.test.ts` | Consumer registration and cleanup (no orphaned consumers). |
| `kafka-client-factory.test.ts` | Client selection: SASL/GSSAPI → Gateway, others → KafkaJS; supported auth methods. |
| `kafka-gateway-client.test.ts`  | Gateway request building, error handling, retry and abort behavior. |
| `kafka-service.test.ts`    | Service timeout, cleanup (disconnect in finally), and fetchEvent response shapes (abort, circuit breaker, topic boundaries). |

Run the full Kafka-related test suite (e.g. `npm test` or vitest for these paths) before and after changes to the operations layer.

## Related

- [KERBEROS_IMPLEMENTATION_SUMMARY.md](./KERBEROS_IMPLEMENTATION_SUMMARY.md) – Kerberos and gateway
- [KAFKA_CONNECTION.md](../modules/kafka/KAFKA_CONNECTION.md) – Connection form and API usage
- [KAFKA_TOPIC_SELECTION.md](../modules/kafka/KAFKA_TOPIC_SELECTION.md) – Topic selector and event fetch
- [ARCHITECTURE_OVERVIEW.md](../architecture/ARCHITECTURE_OVERVIEW.md) – Client factory pattern and service reference
