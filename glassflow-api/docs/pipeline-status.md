# Pipeline Status Feature

This document describes the pipeline status feature that allows tracking the health and status of pipeline components in real-time.

## Pipeline Statuses

### Overall Pipeline Status
- **Created**: Pipeline creation request has been successfully sent to the Kubernetes operator
- **Running**: All components are running successfully
- **Terminating**: Pipeline termination request has been sent to the Kubernetes operator
- **Terminated**: All components have been terminated
- **Failed**: One or more components have failed (To be discussed)

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

**Valid Statuses:**
- `Created`
- `Running`
- `Terminating`
- `Terminated`
- `Failed`

## Integration with Kubernetes Operator

The Kubernetes operator is responsible for:
- Setting component status to `Running` when deployments are ready
- Setting component status to `Terminated` when deployments are deleted

The API automatically:
- Sets status to `Created` when pipeline creation is successful
- Sets status to `Terminating` when pipeline termination is requested


