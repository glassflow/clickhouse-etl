# ClickHouse Mapper: Edit Mode Without Deployment

## 🎯 Problem

When editing an existing pipeline's ClickHouse mapping in standalone mode, clicking "Save Changes" was incorrectly trying to **deploy the pipeline** instead of just saving the mapping to the store:

```
User edits mapping → clicks "Save Changes"
  ↓
❌ Tries to create/deploy pipeline
❌ Calls createPipeline() API
❌ Navigates to pipeline page
  ↓
Result: Pipeline gets redeployed immediately! 😱
```

**Expected behavior**:

- In edit mode, "Save Changes" should **only save to store**
- Deployment should happen when user clicks **"Resume"** button

## ✅ Solution

Updated `completeConfigSave` in `ClickhouseMapper.tsx` to detect standalone edit mode and handle it separately:

### Previous Behavior (Broken)

**`ClickhouseMapper.tsx`** (lines 1073-1086):

```typescript
// ❌ BEFORE: Always tries to deploy or navigate
// Update the store with the new destination config
setClickhouseDestination(updatedDestination)
setApiConfig(apiConfig as Partial<Pipeline>)

setSuccess('Destination configuration saved successfully!')

if (isPreviewMode) {
  // Navigate to the review configuration step for preview
  onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
} else {
  // ❌ Direct mode: Deploy pipeline immediately!
  deployPipelineAndNavigate(apiConfig)
}
```

**Problems**:

- No check for `standalone` edit mode
- Always tries to deploy or navigate
- Doesn't mark configuration as dirty
- Calls `createPipeline()` even when editing existing pipeline

### New Behavior (Fixed)

**`ClickhouseMapper.tsx`** (lines 1073-1101):

```typescript
// ✅ AFTER: Check for standalone edit mode first
// Update the store with the new destination config
setClickhouseDestination(updatedDestination)
setApiConfig(apiConfig as Partial<Pipeline>)

setSuccess('Destination configuration saved successfully!')

// If in standalone edit mode, just save to store and mark as dirty
// The actual deployment will happen when user clicks Resume
if (standalone && toggleEditMode) {
  // Mark the configuration as modified (dirty)
  coreStore.markAsDirty()
  console.log('[ClickhouseMapper] Configuration marked as dirty - changes will be saved on Resume')

  // Close the edit modal
  if (onCompleteStandaloneEditing) {
    onCompleteStandaloneEditing()
  }
  return
}

// For non-standalone mode (regular pipeline creation flow)
if (isPreviewMode) {
  // Navigate to the review configuration step for preview
  onCompleteStep(StepKeys.CLICKHOUSE_MAPPER)
} else {
  // Direct mode: Deploy pipeline immediately and then navigate to pipelines page
  deployPipelineAndNavigate(apiConfig)
}
```

**Key Changes**:

- ✅ Check if in `standalone && toggleEditMode` (edit mode)
- ✅ If editing, just save to store and mark as dirty
- ✅ Close the modal
- ✅ Return early (don't deploy)
- ✅ Only deploy for non-standalone mode (pipeline creation)

## 🔄 Flow Comparison

### Before (Broken)

```
Pipeline running
  ↓
User clicks "ClickHouse Mapper" section
  ↓
User clicks "Edit"
  ↓
Pipeline stops (if running)
  ↓
User modifies mapping (change field mappings, batch size, etc.)
  ↓
User clicks "Save Changes"
  ↓
❌ Calls createPipeline(apiConfig)
❌ Tries to deploy pipeline immediately
❌ Navigates to pipeline page
  ↓
Result: Pipeline gets redeployed! 😱
```

### After (Fixed)

```
Pipeline stopped
  ↓
User clicks "ClickHouse Mapper" section
  ↓
User clicks "Edit"
  ↓
User modifies mapping (change field mappings, batch size, etc.)
  ↓
User clicks "Save Changes"
  ↓
✅ Save mapping to store
✅ Mark configuration as dirty
✅ Close modal
✅ Show success message
  ↓
User clicks "Resume" button (when ready)
  ↓
✅ PipelineDetailsHeader detects dirty flag
✅ Generates full API config
✅ Calls executeAction('edit', apiConfig)
✅ Sends updated config to backend
✅ Resumes pipeline with new mapping
  ↓
Result: Pipeline updated and resumed! 🎉
```

## 📊 Behavior Matrix

| Mode                     | Action         | Behavior                                   |
| ------------------------ | -------------- | ------------------------------------------ |
| **Standalone Edit Mode** | Save Changes   | ✅ Save to store, mark dirty, close modal  |
| **Standalone Edit Mode** | Resume (later) | ✅ Send config to backend, resume pipeline |
| **Pipeline Creation**    | Continue       | ✅ Deploy pipeline immediately             |
| **Preview Mode**         | Continue       | ✅ Navigate to next step                   |

## 🧪 Test Scenarios

### Test Case 1: Edit Mapping in Stopped Pipeline

```
Steps:
1. Open pipeline details (pipeline is stopped)
2. Click "ClickHouse Mapper" section
3. Click "Edit" button
4. Change field mappings or batch size
5. Click "Save Changes"

Expected:
  ✅ Modal shows: "Destination configuration saved successfully!"
  ✅ Modal closes
  ✅ Changes saved to store
  ✅ Configuration marked as dirty
  ✅ NO deployment triggered
  ✅ "Resume" button available

Console:
  [ClickhouseMapper] Configuration marked as dirty - changes will be saved on Resume

When clicking "Resume":
  ✅ Sends updated config to backend
  ✅ Resumes pipeline with new mapping
```

### Test Case 2: Create New Pipeline (Non-Edit Mode)

```
Steps:
1. Navigate to "/pipelines/create"
2. Configure Kafka connection
3. Configure ClickHouse mapper
4. Click "Continue"

Expected:
  ✅ Calls createPipeline()
  ✅ Deploys pipeline immediately
  ✅ Navigates to pipeline details page
  ✅ Shows deployment progress

Result: Normal pipeline creation flow works as before
```

### Test Case 3: Edit Multiple Sections

```
Steps:
1. Open pipeline details (stopped)
2. Edit "Kafka Connection" → Save
3. Edit "Topic Selection" → Save
4. Edit "ClickHouse Mapper" → Save

Expected:
  ✅ All sections save to store
  ✅ Configuration marked as dirty once
  ✅ All modals close
  ✅ NO deployment triggered

When clicking "Resume":
  ✅ Sends ALL changes to backend in one request
  ✅ Resumes pipeline with updated config
```

### Test Case 4: Discard Mapping Changes

```
Steps:
1. Open pipeline details (stopped)
2. Click "ClickHouse Mapper" section
3. Click "Edit"
4. Modify field mappings
5. Click "Discard"

Expected:
  ✅ Changes reverted to original values
  ✅ Modal closes
  ✅ Store unchanged
  ✅ Configuration NOT marked as dirty
```

## 🎯 Integration with Overall Edit Flow

The ClickHouse Mapper now follows the **same pattern** as other editable sections:

### Consistent Edit Flow Across All Sections

1. **Kafka Connection** → Save to store, mark dirty
2. **Topic Selection** → Save to store, mark dirty
3. **Deduplication** → Save to store, mark dirty
4. **Join Configuration** → Save to store, mark dirty
5. **ClickHouse Connection** → Save to store, mark dirty
6. **ClickHouse Mapper** → ✅ Save to store, mark dirty (FIXED)

### Resume Button Behavior

When user clicks "Resume" (in `PipelineDetailsHeader.tsx`):

```typescript
if (action === 'resume') {
  const { coreStore } = useStore.getState()

  if (coreStore.isDirty) {
    // Generate full config from all stores
    const apiConfig = generateApiConfig({
      pipelineId: coreStore.pipelineId,
      pipelineName: coreStore.pipelineName,
      kafkaStore,
      topicsStore,
      clickhouseConnectionStore,
      clickhouseDestinationStore, // ✅ Includes our updated mapping
      joinStore,
      deduplicationStore,
    })

    // Send to backend
    await executeAction('edit', apiConfig)

    // Mark as clean
    coreStore.markAsClean()
  }

  // Resume the pipeline
  await executeAction('resume')
}
```

## 📝 Console Logs

When editing mapping, you'll see:

```
[ClickhouseMapper] Configuration marked as dirty - changes will be saved on Resume
```

When clicking Resume:

```
[PipelineDetailsHeader] Dirty config detected, sending to backend
[PipelineActions] Executing action: edit
[PipelineActions] Executing action: resume
```

## 📦 Files Changed

**`ClickhouseMapper.tsx`** (lines 1080-1092):

- Added check for `standalone && toggleEditMode`
- Save to store and mark as dirty in edit mode
- Close modal and return early (don't deploy)
- Only deploy for non-standalone mode

## 🎉 Benefits

1. **Consistent UX**: All sections now follow the same edit pattern
2. **No Accidental Deploys**: Editing mapping doesn't trigger deployment
3. **Atomic Updates**: All changes sent to backend at once on Resume
4. **Safer Editing**: User can edit multiple sections before resuming
5. **Clear Feedback**: Console logs show what's happening

## 🔗 Related Components

- **Kafka Connection**: Already follows this pattern ✅
- **ClickHouse Connection**: Already follows this pattern ✅
- **ClickHouse Mapper**: Now follows this pattern ✅
- **Topic Selection**: Uses smart schema invalidation ✅
- **PipelineDetailsHeader**: Handles Resume with dirty config ✅

The entire pipeline editing flow is now consistent and predictable! 🚀
