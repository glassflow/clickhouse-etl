# Kerberos Authentication Implementation Summary

## 🎯 Original Task

Implement Kerberos authentication (SASL/GSSAPI) with SSL support for Kafka connections in the UI, enabling connection to external Kerberos-secured Kafka clusters.

## ✅ What's Implemented

### 1. **Dual Kafka Client Architecture**

- **KafkaJS Client**: Handles most authentication methods (PLAIN, SCRAM, AWS IAM, mTLS, SSL)
- **Kafka Gateway Client**: Handles Kerberos (SASL/GSSAPI) via a **Go-based Kafka Gateway** service (HTTP sidecar). The UI calls the gateway; the gateway performs GSSAPI/Kerberos and talks to Kafka. No native Kerberos libraries in the UI.
- **Factory Pattern**: Automatically selects appropriate client based on `authMethod` (SASL/GSSAPI → Gateway; all others → KafkaJS).

### 2. **Kerberos Configuration Support**

- **Keytab File Upload**: Binary keytab files uploaded as base64-encoded data URLs
- **krb5.conf Configuration**: Dynamic Kerberos configuration with KDC settings
- **Principal Management**: Support for Kerberos principals and realms
- **SSL Integration**: CA certificate support for SASL_SSL connections

### 3. **Form Schema Updates**

- **Truststore Subform**: Unified certificate management across all auth methods
- **Conditional Rendering**: Truststore fields shown only for SSL/SASL_SSL protocols
- **File Upload Components**: Specialized components for certificate and keytab files

### 4. **Gateway Client Resilience**

- **Retry with backoff**: The gateway client uses configurable retry for transient HTTP failures (e.g. ECONNREFUSED, ETIMEDOUT) with exponential backoff.
- **AbortSignal**: Request cancellation is supported; the gateway client accepts an optional `AbortSignal` and combines it with an internal timeout so that long-running or cancelled operations are aborted cleanly.

### 5. **Authentication Flow**

- **Connection Test**: Gateway (or KafkaJS) validates connection; for Kerberos the gateway performs the GSSAPI handshake.
- **SSL Handshake**: Proper CA certificate handling for encrypted connections
- **Error Handling**: Comprehensive error handling for authentication failures

## 🔧 Key Technical Details

### File Structure

```
src/lib/
├── kafka-client-interface.ts     # Unified interface (IKafkaClient, KafkaConfig)
├── kafka-client-factory.ts       # Factory: SASL/GSSAPI → Gateway, else KafkaJS
├── kafka-gateway-client.ts       # Kerberos client (HTTP calls to Go gateway)
└── kafka-client.ts               # Standard client (KafkaJS)

src/services/
└── kafka-service.ts              # Timeouts, AbortController, cleanup; uses factory

src/scheme/
└── kafka.scheme.ts               # Zod schemas with truststore subform

src/modules/kafka/components/
└── forms/                        # Auth-specific form components (see KAFKA_CONNECTION.md)
```

For the full Kafka operations layer (API client, service, factory, clients, resilience, tests), see [KAFKA_OPERATIONS_LAYER.md](./KAFKA_OPERATIONS_LAYER.md).

### Configuration Example

```javascript
{
  authMethod: "SASL/GSSAPI",
  servers: "kafka:9092",
  kdc: "kdc-server:88",
  kerberosPrincipal: "admin@EXAMPLE.COM",
  kerberosRealm: "EXAMPLE.COM",
  securityProtocol: "SASL_SSL",
  kerberosKeytab: "data:application/octet-stream;base64,BQIAAABH...",
  certificate: "-----BEGIN CERTIFICATE-----\nMIIECTCCAvGgAwIBAgIUKm45jyN94pSR3ZiYFCVONIvTMz8w...",
  krb5Config: "[libdefaults]\n\tdefault_realm = EXAMPLE.COM\n\n[realms]\n\tEXAMPLE.COM = {\n\t\tkdc = kdc-server\n\t\tadmin_server = kdc-server\n\t}"
}
```

## 🚀 Current Status

### ✅ Working

- Kerberos authentication via Go Kafka Gateway (connection test, topic list, topic details, sample event fetch)
- SSL handshake with CA certificates
- Form validation and file uploads
- Gateway retry with exponential backoff and request cancellation (AbortSignal)
- Connection test, topic listing, topic details, and event fetching for Kerberos connections

### Architecture Note

The UI does **not** use `node-rdkafka` for Kerberos. A previous approach used `node-rdkafka` (RdKafka client) and encountered segmentation faults and limited reliability. The current production approach is the **Go-based Kafka Gateway** (sidecar or separate service), which handles GSSAPI/Kerberos and all Kafka operations for SASL/GSSAPI; the UI only talks HTTP to the gateway.

## 🔮 Future Improvements

### 1. **Enhanced Error Handling**

- Even clearer error messages for Kerberos/gateway failures
- Comprehensive logging for debugging gateway connectivity

### 2. **Production Readiness**

- Health checks for gateway availability
- Optional connection pooling or gateway affinity if needed at scale

## 📝 Usage Notes

### For Development

- Use the Kerberos test setup in `kafka-configs/kafka/kerberos-sasl-ssl/` (optional for testing)
- Ensure the Kafka Gateway is running (e.g. sidecar on localhost:8082 or `KAFKA_GATEWAY_URL`)
- UI connects to Kafka via the gateway for SASL/GSSAPI; no native Kerberos deps in the UI container

### For Production

- Deploy the Kafka Gateway (e.g. sidecar per UI pod); see deployment docs (e.g. KAFKA_GATEWAY_SIDECAR in glassflow-etl-ui-documentation).
- Test thoroughly with actual Kerberos infrastructure

## 🏗️ Architecture Decision

**Why Gateway for Kerberos?**

- KafkaJS does not support Kerberos (GSSAPI) in the browser/Node environment used by the UI.
- A Go-based gateway runs in an environment where Kerberos libraries and keytabs can be used safely; the UI sends connection config (keytab, krb5.conf, etc.) and the gateway performs the GSSAPI handshake and all Kafka operations.
- This avoids native addons (e.g. node-rdkafka) in the UI and provides a stable, production-ready path for Kerberos.
- Factory pattern in the UI selects the gateway client for SASL/GSSAPI and KafkaJS for all other auth methods.

---

_Last Updated: February 2026_
_Status: Kerberos implemented via Go Kafka Gateway (KafkaGatewayClient); retry and AbortSignal supported._
