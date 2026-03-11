# Resource Management in GlassFlow ClickHouse ETL

This document describes how resource management works in the ClickHouse ETL system (GlassFlow API, Kubernetes operator, and Helm charts). It serves as input for planning UI support for resource management.

---

## 1. Executive Summary

Resource management allows users to configure CPU, memory, storage, and replica counts for pipeline components (Ingestor, Join, Sink, Dedup/Transform, NATS stream). The system supports:

- **Per-pipeline resources** – overrides applied when deploying individual pipelines
- **Cluster-wide defaults** – provided by the operator via Helm values and ConfigMap
- **API-driven creation and updates** – create, edit, and update pipelines with custom resources via REST API

The **UI currently does not expose resource management**. Users cannot view or edit resources through the interface. This document provides the backend/API foundation needed to add that support.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              HELM DEPLOYMENT                                          │
│                                                                                       │
│  glassflow-operator chart                    glassflow-etl chart                       │
│  ┌───────────────────────────────┐          ┌─────────────────────────────┐           │
│  │ glassflow-operator-config     │          │ API deployment              │           │
│  │ (ConfigMap)                   │          │ (no resource env vars)      │           │
│  │ - INGESTOR_CPU_REQUEST, etc.  │          │ Uses hardcoded defaults     │           │
│  │ - JOIN_*, SINK_*, DEDUP_*     │          │ in NewDefaultPipelineResources│          │
│  │ - NATS_MAX_STREAM_AGE/BYTES   │          └─────────────────────────────┘           │
│  └───────────────────────────────┘                                                      │
│            │ envFrom                                                                   │
│            ▼                                                                           │
│  ┌───────────────────────────────┐                                                    │
│  │ Operator deployment           │                                                    │
│  │ (reads env as fallback defaults)                                                    │
│  └───────────────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Pipeline CR spec.Resources (per-pipeline overrides)
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  K8s Operator reconciles Pipeline CR                                                 │
│  - If spec.Resources present → use per-pipeline values                               │
│  - Else → use operator env vars (from ConfigMap)                                     │
│  - Applies to: Ingestor, Join, Sink, Dedup StatefulSets; NATS stream config          │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 API Model (`glassflow-api/internal/models/resources.go`)

```go
type PipelineResources struct {
    Nats      *NatsResources      `json:"nats,omitempty"`
    Ingestor  *IngestorResources  `json:"ingestor,omitempty"`
    Join      *ComponentResources `json:"join,omitempty"`
    Sink      *ComponentResources `json:"sink,omitempty"`
    Transform *ComponentResources `json:"transform,omitempty"`  // maps to Dedup in operator
}

type IngestorResources struct {
    Base  *ComponentResources `json:"base,omitempty"`   // single stream (no join)
    Left  *ComponentResources `json:"left,omitempty"`   // stream 0 when join enabled
    Right *ComponentResources `json:"right,omitempty"`  // stream 1 when join enabled
}

type ComponentResources struct {
    Requests *ResourceList  `json:"requests,omitempty"`  // CPU, Memory
    Limits   *ResourceList  `json:"limits,omitempty"`
    Storage  *StorageConfig `json:"storage,omitempty"`   // Transform/Dedup only
    Replicas *int64         `json:"replicas,omitempty"`
}

type ResourceList struct {
    CPU    string `json:"cpu,omitempty"`    // e.g. "100m", "1500m"
    Memory string `json:"memory,omitempty"` // e.g. "128Mi", "1.5Gi"
}

type NatsStreamResources struct {
    MaxAge   string `json:"maxAge,omitempty"`   // e.g. "24h"
    MaxBytes string `json:"maxBytes,omitempty"` // e.g. "10Gi", "100GB"
}
```

### 3.2 Operator Model (`glassflow-etl-k8s-operator/api/v1alpha1/pipeline_types.go`)

The CRD uses `resource.Quantity` and `metav1.Duration` instead of strings. The API model `Transform` maps to operator `Dedup`.

### 3.3 Component Visibility by Pipeline Type

| Pipeline Config              | Components with Resources |
|-----------------------------|---------------------------|
| Join disabled               | Ingestor (Base), Sink, optionally Transform (if dedup/filter/stateless enabled) |
| Join enabled                | Ingestor (Left, Right), Join, Sink, optionally Transform |
| NATS stream                 | Always present (nats.stream.maxAge, nats.stream.maxBytes) |
| Dedup enabled               | Transform has Storage and Replicas (replicas immutable when dedup enabled) |

---

## 4. Immutability Rules

Certain resource fields **cannot be changed after pipeline creation**:

| Field path             | Reason |
|------------------------|--------|
| `nats/stream/maxAge`   | NATS stream configuration |
| `nats/stream/maxBytes` | NATS stream configuration |
| `transform/storage/size` | Dedup uses persistent storage; changing requires PVC recreation |
| `transform/replicas`   | Only when dedup is enabled (stateful storage) |

The API returns `fields_policy.immutable` on `GET /api/v1/pipeline/{id}/resources` so the UI can disable editing of these fields for existing pipelines.

---

## 5. API Endpoints

### 5.1 Create Pipeline – `POST /api/v1/pipeline`

**Request body** (partial; full pipeline config):

```json
{
  "pipeline_id": "my-pipeline",
  "name": "My Pipeline",
  "source": { ... },
  "sink": { ... },
  "schema": { ... },
  "pipeline_resources": {
    "nats": { "stream": { "maxAge": "24h", "maxBytes": "10Gi" } },
    "ingestor": {
      "base": {
        "requests": { "cpu": "500m", "memory": "512Mi" },
        "limits": { "cpu": "1000m", "memory": "1Gi" },
        "replicas": 2
      }
    },
    "sink": {
      "requests": { "cpu": "500m", "memory": "512Mi" },
      "limits": { "cpu": "1500m", "memory": "1.5Gi" }
    },
    "transform": {
      "requests": { "cpu": "200m", "memory": "256Mi" },
      "limits": { "cpu": "500m", "memory": "512Mi" },
      "storage": { "size": "20Gi" },
      "replicas": 1
    }
  }
}
```

- `pipeline_resources` is **optional**.
- If omitted or all fields empty, defaults are used.
- Partial values are merged with defaults via `MergeWithDefaults()`.

### 5.2 Get Pipeline Resources – `GET /api/v1/pipeline/{id}/resources`

**Response:**

```json
{
  "pipeline_resources": {
    "nats": { "stream": { "maxAge": "24h", "maxBytes": "10Gi" } },
    "ingestor": { "base": { ... } },
    "sink": { ... },
    "transform": { ... }
  },
  "fields_policy": {
    "immutable": ["nats/stream/maxAge", "nats/stream/maxBytes", "transform/storage/size", "transform/replicas"]
  }
}
```

Use this for the **dedicated resources step** in the UI.

### 5.3 Update Pipeline Resources – `PUT /api/v1/pipeline/{id}/resources`

**Requirements:**
- Pipeline must be **stopped** or **failed**.
- Immutable fields cannot be changed.

**Request body:**

```json
{
  "pipeline_resources": {
    "sink": {
      "requests": { "cpu": "1000m", "memory": "1Gi" },
      "limits": { "cpu": "2000m", "memory": "2Gi" }
    }
  }
}
```

- Supports partial updates; unset fields remain unchanged.
- Merged with defaults before validation and persistence.

### 5.4 Get Pipeline – `GET /api/v1/pipeline/{id}`

Returns full pipeline config including `pipeline_resources` in the response body (via `toPipelineJSON()`).

### 5.5 Edit Pipeline – `POST /api/v1/pipeline/{id}/edit`

- Accepts full `pipelineJSON` body including `pipeline_resources`.
- Pipeline must be **stopped** or **failed**.
- Same validation and immutability rules as create/update.
- Internally uses `NewPipelineResources` and `UpsertPipelineResources`, then calls orchestrator `EditPipeline`.

---

## 6. Default Values

### 6.1 API Defaults (when env vars not set)

Defined in `NewDefaultPipelineResources()` in `models/resources.go`:

| Component  | CPU Request | CPU Limit | Memory Request | Memory Limit |
|------------|-------------|-----------|----------------|--------------|
| Ingestor   | 100m        | 1500m     | 128Mi          | 1.5Gi        |
| Join       | 100m        | 1500m     | 128Mi          | 1.5Gi        |
| Sink       | 100m        | 1500m     | 128Mi          | 1.5Gi        |
| Transform  | 100m        | 1500m     | 128Mi          | 1.5Gi        |
| NATS Stream| maxAge: 24h | maxBytes: 0 | –            | –            |
| Dedup Storage | –        | –         | –              | 10Gi         |

The API reads `INGESTOR_CPU_REQUEST`, `JOIN_CPU_REQUEST`, etc. via `getEnvOrDefault()` when present. The glassflow-etl chart does **not** mount these env vars into the API; only the operator gets them from its ConfigMap. So in typical deployments, the API uses the hardcoded values above.

### 6.2 Operator Defaults (Helm – glassflow-operator chart)

From `glassflow-etl-k8s-operator/charts/glassflow-operator/values.yaml`:

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| Ingestor  | 1000m       | 1500m     | 1Gi            | 1.5Gi        |
| Join      | 1000m       | 1500m     | 1Gi            | 1.5Gi        |
| Sink      | 1000m       | 1500m     | 1Gi            | 1.5Gi        |
| Dedup     | 1000m       | 1000m     | 1Gi            | 4Gi          |
| Dedup Storage | –       | –         | –              | 40Gi         |
| NATS Stream   | maxAge: 168h | maxBytes: 100GB | –        | –            |

These flow: `values.yaml` → `glassflow-operator-config` ConfigMap → operator deployment `envFrom` → operator flags via `getEnvOrDefault()` in `cmd/main.go`.

### 6.3 Precedence

1. **Per-pipeline resources** (from API, stored in DB, passed to operator via Pipeline CR `spec.Resources`) – highest priority.
2. **Operator env vars** (from ConfigMap) – used when `spec.Resources` has no override for that component.
3. **Operator flag defaults** (in `main.go`) – used when env vars are not set.

---

## 7. Deployment Flow

### 7.1 Create Pipeline

1. Client sends `POST /api/v1/pipeline` with optional `pipeline_resources`.
2. API `CreatePipeline`:
   - `NewPipelineResources` → validate and merge with defaults.
   - If `pipeline_resources` is empty, use `NewDefaultPipelineResources`.
   - Insert pipeline and upsert `pipeline_resources` in DB.
   - Call `orchestrator.SetupPipeline(cfg)`.
3. K8s orchestrator:
   - `createPipelineConfigSecret` – stores full config (including resources) in secret `pipeline-config-{id}`.
   - `buildPipelineSpec` → `toOperatorResources(cfg.PipelineResources)` → `spec.Resources` on Pipeline CR.
   - Create Pipeline CR.
4. Operator reconciles:
   - For each component (Ingestor, Join, Sink, Dedup): if `p.Spec.Resources` has overrides, use them; otherwise use operator env/flag defaults.
   - Applies resources to StatefulSet container specs.

### 7.2 Edit Pipeline (includes resources)

1. Client sends `POST /api/v1/pipeline/{id}/edit` with full config including `pipeline_resources`.
2. Pipeline must be **stopped** or **failed**.
3. API `EditPipeline`:
   - `NewPipelineResources` → validate and merge.
   - Upsert resources to DB.
   - Update pipeline in DB.
   - Call `orchestrator.EditPipeline(pid, newCfg)`.
4. K8s orchestrator:
   - `updatePipelineConfigSecret` with new config.
   - `buildPipelineSpec` with new resources.
   - Update Pipeline CR spec and add edit annotation.
5. Operator reconciles with new spec and applies resources to components.

### 7.3 Update Resources Only

1. Client sends `PUT /api/v1/pipeline/{id}/resources`.
2. Pipeline must be **stopped** or **failed**.
3. API validates immutability and quantities, merges with defaults, upserts to DB.
4. **Important:** The orchestrator is **not** called. Resources are only updated in the DB. They take effect when the pipeline is **resumed** (or recreated). The UI must surface a clear message that changes apply on next deployment/resume.

---

## 8. Database Schema

```sql
CREATE TABLE pipeline_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    resources JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pipeline_id)
);
```

---

## 9. Validation Rules

- **Quantities:** CPU, memory, and storage use Kubernetes `resource.ParseQuantity()` (e.g. `100m`, `1Gi`, `10Gi`).
- **NATS maxAge:** Valid Go duration (e.g. `24h`, `168h`).
- **NATS maxBytes:** Kubernetes quantity or human bytes (`100GB`, `1TB`).
- **Join replicas:** Must be 1 (enforced in `NewPipelineResources`).
- **Immutability:** Enforced on update; old vs new compared via JSON path for `fields_policy.immutable`.

---

## 10. Operator Component Mapping

| API Component | Operator Component | Notes |
|---------------|-------------------|-------|
| `ingestor.base` | Ingestor stream 0 | When join disabled |
| `ingestor.left` | Ingestor stream 0 | When join enabled |
| `ingestor.right` | Ingestor stream 1 | When join enabled |
| `join` | Join | Only when join enabled |
| `sink` | Sink | Always |
| `transform` | Dedup | When filter/stateless/dedup enabled |
| `nats` | NATS stream config | Per-pipeline overrides for maxAge/maxBytes |

---

## 11. UI Implementation Hooks

### 11.1 Where to Integrate

1. **Create pipeline flow:** Add a **Resources step** before deploy:
   - **Defaults:** Read `NEXT_PUBLIC_RESOURCE_DEFAULTS` from env (via `getResourceDefaults()`); fallback to hardcoded defaults if unset. Filter sections by pipeline shape (join/transform) from wizard stores.
   - Allow editing CPU/memory requests and limits, replicas (where allowed), storage (Dedup), NATS stream settings.
   - Include optional `pipeline_resources` in `POST /api/v1/pipeline`.

2. **Edit pipeline flow:** Same Resources step:
   - Load resources via `GET /api/v1/pipeline/{id}/resources` (or from full `GET /api/v1/pipeline/{id}`).
   - Show `fields_policy.immutable` and disable those fields.
   - On save, either:
     - Include resources in `POST /api/v1/pipeline/{id}/edit`, or
     - Call `PUT /api/v1/pipeline/{id}/resources` separately if only resources changed.
   - Ensure pipeline is stopped; surface status and validation errors.

3. **Resources-only updates:** Provide a way to edit resources when pipeline is stopped:
   - `GET /api/v1/pipeline/{id}/resources` to load.
   - `PUT /api/v1/pipeline/{id}/resources` to save.
   - Show message: "Changes apply when the pipeline is resumed."

### 11.2 API Response Shape

Use `GET /api/v1/pipeline/{id}/resources` for the resources UI step; it returns both `pipeline_resources` and `fields_policy.immutable`. `GET /api/v1/pipeline/{id}` also includes `pipeline_resources` if you prefer a single fetch.

### 11.3 Error Handling

- **409 Conflict:** Pipeline not stopped when editing or updating resources.
- **422 Unprocessable Entity:** Validation errors (quantities, immutability).
- **404 Not Found:** Pipeline or resources not found.

---

## 12. Resource Defaults: Source and Flow to UI

### 12.1 Where Defaults Originate

| Layer | Source | How it's used |
|-------|--------|---------------|
| **Operator** | `glassflow-operator-config` ConfigMap (from Helm `glassflow-operator.glassflowComponents.*.resources`, `global.nats.stream`) | Mounted via `envFrom`; operator reads `INGESTOR_CPU_REQUEST`, `JOIN_CPU_REQUEST`, etc. as fallbacks when per-pipeline `spec.Resources` has no override |
| **API** | `getEnvOrDefault()` in `NewDefaultPipelineResources()` – hardcoded fallbacks | API deployment typically does **not** receive resource env vars from glassflow-etl chart; uses code defaults |
| **UI** | No current source | UI has no way to show defaults during create (no pipeline ID yet, so `GET /resources` is not available) |

### 12.2 Problem: Create Flow Has No Pipeline ID

During pipeline creation, the user has not deployed yet. There is no pipeline ID, so:

- `GET /api/v1/pipeline/{id}/resources` cannot be called
- The API cannot return pipeline-specific defaults
- The UI must get defaults from somewhere else to pre-populate the Resources step

### 12.3 Solution: Pass Defaults to UI via Environment Variables

The UI already has a runtime env system (`window.__ENV__`, `getRuntimeEnv()`, `generate-env.mjs`, `startup.sh`, `glassflow-ui-config` ConfigMap). We extend this to pass resource defaults.

**Flow:**

```
Helm values (glassflow-etl chart)
  glassflow-operator.glassflowComponents.ingestor.resources
  glassflow-operator.glassflowComponents.join.resources
  glassflow-operator.glassflowComponents.sink.resources
  glassflow-operator.glassflowComponents.dedup.resources + storage
  global.nats.stream.maxAge, maxBytes
        │
        ▼
glassflow-ui-config ConfigMap (extended)
  NEXT_PUBLIC_RESOURCE_DEFAULTS = JSON string of PipelineResources structure
        │
        ▼
UI container envFrom + env
        │
        ▼
startup.sh / generate-env.mjs (extends env.js)
  NEXT_PUBLIC_RESOURCE_DEFAULTS in window.__ENV__
        │
        ▼
UI config module: getResourceDefaults()
  Parses JSON, returns PipelineResources for Resources step
```

**Single env var:** `NEXT_PUBLIC_RESOURCE_DEFAULTS` – a JSON string containing the full `PipelineResources` structure. This avoids 20+ individual env vars.

**Build in Helm:** The glassflow-etl chart's `ui-configmap.yaml` (or a values-driven template) constructs this JSON from `.Values.glassflow-operator.glassflowComponents` and `.Values.global.nats`, then injects it. The structure must match the API `PipelineResources` shape (ingestor.base, join, sink, transform, nats.stream).

**Pipeline shape:** Defaults for Ingestor Base/Left/Right, Join, Sink, Transform, NATS are all included. The Resources step filters which sections to show based on pipeline config (join enabled, transform enabled) from the wizard stores – same logic as the overview's component visibility table.

### 12.4 Fallback When Env Not Set

If `NEXT_PUBLIC_RESOURCE_DEFAULTS` is unset (e.g. local dev, older deployments), the UI should use **hardcoded fallbacks** matching the API's `NewDefaultPipelineResources` defaults (see §6.1). This keeps the Resources step usable without Helm changes.

### 12.5 Edit Flow: Different Source

For edit flow, we have a pipeline ID. The UI calls `GET /api/v1/pipeline/{id}/resources`, which returns stored resources plus `fields_policy.immutable`. No env-based defaults are needed for edit; the API response is the source of truth.

---

## 13. Open Questions and Notes

1. **API vs operator defaults mismatch:** API hardcodes different defaults than the operator Helm values. Consider aligning or documenting why they differ.
2. **Update resources without deploy:** `PUT /api/v1/pipeline/{id}/resources` only updates the DB; orchestrator is not called. Changes apply on next resume. The UI should make this explicit.
3. **Helm charts:** The glassflow-etl chart (API/UI) lives under `charts/charts/glassflow-etl/`. The operator chart is in `glassflow-etl-k8s-operator/charts/glassflow-operator/`. Resource env vars are only in the operator chart.
4. **Docker/local mode:** When using local orchestrator, pipelines may use different defaults; the same API and models apply.

---

## 14. File Reference

| Area | Path |
|------|------|
| API models | `clickhouse-etl/glassflow-api/internal/models/resources.go` |
| API configs | `clickhouse-etl/glassflow-api/internal/models/configs.go` |
| Create pipeline | `clickhouse-etl/glassflow-api/internal/api/create_pipeline.go` |
| Get/Update resources | `clickhouse-etl/glassflow-api/internal/api/get_pipeline_resources.go`, `update_pipeline_resources.go` |
| Edit pipeline | `clickhouse-etl/glassflow-api/internal/api/edit_pipeline.go` |
| Pipeline JSON schema | `clickhouse-etl/glassflow-api/internal/api/pipeline.go` |
| Pipeline service | `clickhouse-etl/glassflow-api/internal/service/pipeline.go` |
| K8s orchestrator | `clickhouse-etl/glassflow-api/internal/orchestrator/k8s.go` |
| DB storage | `clickhouse-etl/glassflow-api/internal/storage/postgres/pipeline_resources.go` |
| Migration | `clickhouse-etl/glassflow-api/migrations/000003_pipeline_resources.up.sql` |
| Operator CRD | `glassflow-etl-k8s-operator/api/v1alpha1/pipeline_types.go` |
| Operator create components | `glassflow-etl-k8s-operator/internal/controller/create_components.go` |
| Operator main/env | `glassflow-etl-k8s-operator/cmd/main.go` |
| Operator ConfigMap | `glassflow-etl-k8s-operator/charts/glassflow-operator/templates/configmap.yaml` |
| Operator values | `glassflow-etl-k8s-operator/charts/glassflow-operator/values.yaml` |
| ETL chart values | `charts/charts/glassflow-etl/values.yaml` |
| UI ConfigMap | `charts/charts/glassflow-etl/templates/ui-configmap.yaml` |
| UI env (startup) | `clickhouse-etl/ui/startup.sh`, `clickhouse-etl/ui/generate-env.mjs` |
