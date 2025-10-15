# Pipeline Editing Feature - Revised Implementation (v2)

## Overview
This document outlines the **corrected** implementation of the pipeline editing feature, which allows users to edit pipeline configurations through the UI.

**Important**: This is the revised version that implements the correct flow:
- **Edit mode**: Saves changes to local store only
- **Save button**: Updates store and marks config as dirty  
- **Resume button**: Sends updated config to backend THEN resumes pipeline

This ensures that configuration changes are only sent to the backend when the user explicitly resumes the pipeline, not immediately when saving edits.

## Key Changes

### 1. **StandaloneStepRenderer.tsx** - Edit Mode Management

**Fixed Issues:**
- Removed hardcoded `setEditMode(false)` that prevented edit mode from being enabled
- Changed from "pause" to "stop" action (backend requires stopped status for editing)
- Added proper state management for stopped/paused pipelines

**Key Functions:**

```typescript
// Handles edit button click and modal display
const handleToggleEditMode = () => {
  if (pipeline?.status === 'active' && !editMode) {
    // Show confirmation modal for active pipelines
    openEditConfirmationModal(pipeline, stepInfo)
  } else if ((pipeline?.status === 'paused' || pipeline?.status === 'stopped') && !editMode) {
    // Enable edit mode immediately for stopped/paused pipelines
    setEditMode(true)
    enterEditMode(pipeline)
  } else {
    // Exit edit mode (discard changes)
    setEditMode(false)
  }
}

// Handles confirmation and stops the pipeline
const handleEditConfirmation = async () => {
  // Stop the pipeline (backend requirement)
  await executeAction('stop', { graceful: true })
  
  // Update local status
  onPipelineStatusUpdate?.('stopped')
  
  // Wait for propagation
  await new Promise(resolve => setTimeout(resolve, 1000))
  
  // Enable edit mode
  setEditMode(true)
  enterEditMode(pipeline)
}
```

### 2. **KafkaConnectionFormManager.tsx** - Form Submission Logic

**Fixed Issues:**
- Properly differentiated between read-only (test connection) and edit mode (save to store)
- Removed immediate backend API call - now only saves to local store
- Backend update happens only when user clicks Resume

**Key Function:**

```typescript
const submitFormValues = async () => {
  // Validate form
  const result = await formMethods.trigger()
  if (!result) return
  
  // Read-only mode or create mode: just test connection
  if (readOnly || !standalone || !toggleEditMode) {
    await onTestConnection(values)
    return
  }
  
  // Edit mode: save to store only (not backend)
  // 1. Update stores with form values
  kafkaStore.setKafkaBootstrapServers(values.bootstrapServers)
  kafkaStore.setKafkaSecurityProtocol(values.securityProtocol)
  // ... other updates
  
  // 2. Mark configuration as dirty
  coreStore.markAsDirty()
  
  // 3. Close the modal
  if (toggleEditMode) {
    await toggleEditMode()
  }
}
```

### 3. **KafkaConnectionContainer.tsx** - Save Handler

**Key Function:**

```typescript
const handleFormSubmit = async () => {
  // When save is clicked in edit mode, just close the modal
  // Changes are already saved to the store by the form manager
  // The actual backend update happens when user clicks Resume
  if (onCompleteStandaloneEditing) {
    onCompleteStandaloneEditing()
  }
}
```

### 4. **FormEditActionButtonGroup.tsx** - Button States

**Updated:**
- Changed pipeline action check from 'pause' to 'stop' and 'edit'
- Proper button visibility based on `editMode` state

```typescript
const isPipelineActionInProgress = 
  pipelineActionState?.isLoading && 
  (pipelineActionState?.lastAction === 'stop' || pipelineActionState?.lastAction === 'edit')
```

### 5. **PipelineDetailsHeader.tsx** - Resume with Config Update

**New Feature:**
- Intercepts Resume action to check for unsaved changes
- Sends edit API call before resuming if config is dirty

**Key Function:**

```typescript
// Inside handleActionClick for 'resume' action
if (action === 'resume') {
  // Check if there are unsaved changes before resuming
  const { coreStore } = useStore.getState()
  if (coreStore.isDirty) {
    // Generate and send updated configuration before resuming
    const apiConfig = generateApiConfig({ /* all store data */ })
    
    // Send edit request to backend
    await executeAction('edit', apiConfig)
    
    // Mark as clean after successful save
    coreStore.markAsClean()
  }
  
  // Then resume the pipeline
  operations.reportResume(pipeline.pipeline_id)
}
```

### 6. **pipeline-api.ts** - Edit API with Error Handling

```typescript
export const editPipeline = async (id: string, config: Pipeline): Promise<Pipeline> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
  
  // Handle backend validation errors
  if (response.status === 400 && errorMessage.includes('Pipeline must be stopped')) {
    throw {
      code: 400,
      message: 'Pipeline must be stopped before editing. Please pause the pipeline first.',
      requiresPause: true
    }
  }
}
```

## User Flow

### Editing an Active Pipeline

1. **User clicks "Edit"** on any pipeline step
2. **System shows confirmation modal**: "This will stop the pipeline. Continue?"
3. **User confirms** → System calls `executeAction('stop')`
4. **Pipeline stops** → Status updated to "stopped"
5. **Edit mode enabled** → Form fields become editable
6. **User makes changes** → Form validation active
7. **User clicks "Save changes"** → System:
   - Updates all relevant stores with form values
   - Marks configuration as dirty (`coreStore.markAsDirty()`)
   - **Does NOT send to backend yet**
   - Closes the edit modal
8. **Save successful** → Modal closes, user returns to pipeline details
9. **User clicks "Resume"** → System:
   - Checks if configuration is dirty
   - If dirty: Generates complete API config
   - Sends `POST /api/v1/pipeline/{id}/edit` to backend
   - Marks configuration as clean
   - Then resumes the pipeline

### Editing a Stopped/Paused Pipeline

1. **User clicks "Edit"** on any pipeline step
2. **Edit mode enabled immediately** (no confirmation needed)
3. **User makes changes** and clicks "Save changes"
4. **System saves to store** (not backend yet)
5. **User clicks "Resume"** → Updated config sent to backend, then pipeline resumes

### Canceling Edit

1. **User clicks "Discard"** → Changes discarded, form reset
2. **Edit mode disabled** → Returns to read-only view
3. **Pipeline remains stopped** → User must manually resume
4. **No backend update** → Changes never sent to API

## Backend Requirements

- **Endpoint**: `POST /api/v1/pipeline/{id}/edit`
- **Status Requirement**: Pipeline MUST be in `stopped` state
- **Request Body**: Complete pipeline configuration (same as create)
- **Error Handling**: Returns 400 if pipeline is not stopped

## Loading States

- "Stopping pipeline for editing..." - When stopping active pipeline
- "Saving pipeline configuration..." - When saving edits
- "Resuming pipeline..." - When user manually resumes
- "Testing..." - When testing connection in read-only mode

## Type Definitions

```typescript
// toggleEditMode prop accepts optional API config
toggleEditMode?: (apiConfig?: any) => void

// Pipeline action state
interface PipelineActionState {
  isLoading: boolean
  error: string | null
  lastAction: PipelineAction | null
}

type PipelineAction = 'stop' | 'resume' | 'edit' | 'delete' | 'rename'
```

## Testing Checklist

- [ ] Click "Edit" on Kafka connection step (active pipeline)
  - [ ] Modal appears with confirmation
  - [ ] Clicking "Confirm" stops pipeline
  - [ ] Form becomes editable after pipeline stops
- [ ] Click "Edit" on Kafka connection step (stopped pipeline)
  - [ ] Form becomes editable immediately (no modal)
- [ ] Make changes and click "Save changes"
  - [ ] Loading state shows "Saving pipeline configuration..."
  - [ ] Configuration saved successfully
  - [ ] Modal closes after save
- [ ] Click "Discard" while editing
  - [ ] Changes discarded
  - [ ] Form returns to read-only
- [ ] Try to edit without stopping pipeline
  - [ ] Backend returns error
  - [ ] Error message displayed to user
- [ ] Resume pipeline after editing
  - [ ] User clicks "Resume" button
  - [ ] Pipeline starts with new configuration

## Known Limitations

1. **Manual Resume Required**: After editing and saving, users must manually click "Resume" to restart the pipeline
2. **Full Stop Required**: Pipeline must be fully stopped (not just paused) before editing
3. **Kafka Connection Only**: Currently only Kafka connection step fully implemented
4. **No Concurrent Edits**: No protection against multiple users editing same pipeline

## Next Steps

1. Extend edit functionality to other steps (ClickHouse connection, topics, etc.)
2. Add visual indicators showing pipeline is stopped and needs manual resume
3. Add confirmation when closing edit modal with unsaved changes
4. Implement optimistic UI updates for better UX
5. Add edit history/audit trail
6. Add concurrent edit detection and warning

## Files Modified

- `clickhouse-etl/ui/src/modules/pipelines/[id]/StandaloneStepRenderer.tsx`
- `clickhouse-etl/ui/src/modules/kafka/components/KafkaConnectionFormManager.tsx`
- `clickhouse-etl/ui/src/modules/kafka/KafkaConnectionContainer.tsx`
- `clickhouse-etl/ui/src/components/shared/FormEditActionButtonGroup.tsx`
- `clickhouse-etl/ui/src/api/pipeline-api.ts`
- `clickhouse-etl/ui/src/hooks/usePipelineActions.ts`

## Architecture Diagram

```
User Action: Click "Edit"
    ↓
StandaloneStepRenderer.handleToggleEditMode()
    ↓
[Active Pipeline?] → Yes → Show Confirmation Modal
    ↓                          ↓
    No                    User Confirms
    ↓                          ↓
    ↓                    executeAction('stop')
    ↓                          ↓
    ↓                    onPipelineStatusUpdate('stopped')
    ↓                          ↓
    ↓ ←─────────────────────────
    ↓
setEditMode(true) + enterEditMode(pipeline)
    ↓
Form becomes editable (readOnly = false)
    ↓
User makes changes
    ↓
User clicks "Save changes"
    ↓
KafkaConnectionFormManager.submitFormValues()
    ↓
1. Update all stores with form values
    ↓
2. Mark configuration as dirty (coreStore.markAsDirty())
    ↓
3. Close modal
    ↓
User returns to pipeline details
    ↓
User clicks "Resume" button
    ↓
PipelineDetailsHeader.handleActionClick('resume')
    ↓
Check: Is config dirty? → Yes
    ↓                      ↓
    No                     Generate API Config
    ↓                      ↓
    ↓                      API Call: POST /api/v1/pipeline/{id}/edit
    ↓                      ↓
    ↓                      Mark as clean (coreStore.markAsClean())
    ↓                      ↓
    ↓ ←────────────────────
    ↓
executeAction('resume')
    ↓
Pipeline resumes with updated configuration
```

