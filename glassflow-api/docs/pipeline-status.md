# Pipeline Status Feature

This document describes the pipeline status feature that allows tracking the health and status of pipeline components in real-time.

## Pipeline Statuses

### Overall Pipeline Status
- **Created**: Pipeline creation request has been successfully sent to the orchestrator
- **Running**: All components are running successfully
- **Stopping**: Pipeline stop request has been sent to the orchestrator (graceful shutdown)
- **Stopped**: All components have been stopped gracefully
- **Terminating**: Pipeline termination request has been sent to the orchestrator (ungraceful shutdown)
- **Failed**: One or more components have failed
- **Resuming**: Pipeline resume request has been sent to the orchestrator

### Component Statuses
For now, this is not added. TBD

## API Endpoints

### Get Pipeline Health
```
GET /api/v1/pipeline/{id}/health
```

Returns the current health status of a pipeline including:
- Overall pipeline status

**Response Example:**
```json
{
  "pipeline_id": "my-pipeline",
  "pipeline_name": "My Pipeline",
  "overall_status": "Running",
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Stop Pipeline (Graceful)
```
POST /api/v1/pipeline/{id}/stop
```

Stops the pipeline gracefully, allowing pending messages to be processed before shutdown.

**Response:** `204 No Content` on success

**Status Transition:** `Running` → `Stopping` → `Stopped`

### Terminate Pipeline (Ungraceful)
```
POST /api/v1/pipeline/{id}/terminate
```

Terminates the pipeline immediately without waiting for pending messages to be processed.

**Response:** `204 No Content` on success

**Status Transition:** `Running` → `Terminating` → `Stopped`

### Resume Pipeline
```
POST /api/v1/pipeline/{id}/resume
```

Resumes a stopped pipeline, bringing it back to running state.

**Response:** `204 No Content` on success

**Status Transition:** `Stopped` → `Resuming` → `Running`

### Delete Pipeline
```
DELETE /api/v1/pipeline/{id}
```

Deletes a pipeline and all its resources. Pipeline must be in `Stopped` state.

**Response:** `204 No Content` on success

**Prerequisites:** Pipeline must be in `Stopped` state

**Valid Statuses:**
- `Created`
- `Running`
- `Stopping`
- `Stopped`
- `Terminating`
- `Failed`
- `Resuming`

## Status Transition Flow

### Valid Status Transitions

The following status transitions are supported:

- `Created` → `Running` (when pipeline starts successfully)
- `Running` → `Stopping` (when stop is requested)
- `Running` → `Terminating` (when terminate is requested)
- `Stopping` → `Stopped` (when graceful shutdown completes)
- `Terminating` → `Stopped` (when ungraceful shutdown completes)
- `Stopped` → `Resuming` (when resume is requested)
- `Resuming` → `Running` (when resume completes successfully)
- Any status → `Failed` (when errors occur)

### Pipeline Operations

#### Stop vs Terminate
- **Stop**: Graceful shutdown that waits for pending messages to be processed
- **Terminate**: Immediate shutdown that doesn't wait for pending messages

#### Resume
- Can only be performed from `Stopped` state
- Brings the pipeline back to `Running` state

#### Delete
- Can only be performed from `Stopped` state
- Removes all pipeline resources and configuration

## Integration with Orchestrators

### Docker Orchestrator (Local)
- Handles graceful shutdown by waiting for consumers to clear pending messages
- Manages container lifecycle and resource cleanup
- Deletes from NATS KV store when pipeline is deleted

### Kubernetes Orchestrator
- Sets component status to `Running` when deployments are ready
- Sets component status to `Stopped` when deployments are terminated
- Manages Kubernetes resource lifecycle
- Operator handles actual resource deletion when pipeline is deleted

The API automatically:
- Sets status to `Created` when pipeline creation is successful
- Sets status to `Stopping` when stop is requested
- Sets status to `Terminating` when terminate is requested
- Sets status to `Resuming` when resume is requested


