# ClickHouse Connection: Test on Edit Fix

## 🐛 Problem

When editing ClickHouse connection parameters in standalone mode:

```
User clicks "Edit" → modifies connection details
  ↓
User clicks "Save changes"
  ↓
Connection test starts (spinner shows)
  ↓
If connection FAILS (wrong port, wrong credentials, etc.):
  ❌ Spinner spins indefinitely
  ❌ No error message displayed
  ❌ Form closes anyway!
  ❌ Bad connection details saved to store
  ↓
User has no idea what went wrong! 😫
```

**Issues**:

1. **No feedback** on connection failures
2. **Form closes** even when connection test fails
3. **Invalid connection** saved to store
4. **Infinite spinner** - no timeout or error handling

## ✅ Solution

Applied the **same fix as Kafka connection**: Test the connection and only save/close if successful.

### Previous Behavior (Broken)

**`ClickhouseConnectionFormManager.tsx`** (lines 172-190):

```typescript
// ❌ BEFORE: Always saves and closes, regardless of success
if (standalone) {
  try {
    if (onTestConnection) {
      await onTestConnection(values) // Test connection
    }

    // Always mark as dirty and close - NO SUCCESS CHECK!
    const { coreStore } = useStore.getState()
    coreStore.markAsDirty()

    if (onClose) {
      onClose() // ❌ Closes even if connection failed!
    }
  } catch (error) {
    console.error('Failed to save changes to store:', error)
  }
}
```

**Problems**:

- No check if `onTestConnection` succeeded
- Always closes the modal
- Saves invalid connection details

### New Behavior (Fixed)

**`ClickhouseConnectionFormManager.tsx`** (lines 148-180):

```typescript
// ✅ AFTER: Only saves and closes if test succeeds
const submitFormValues = async () => {
  const values = formMethods.getValues()
  setUserInteracted(true)

  const result = await formMethods.trigger()
  if (!result) return // Validation failed

  // In standalone mode (both create and edit), always test the connection
  // Only save if the test succeeds
  if (standalone) {
    if (onTestConnection) {
      await onTestConnection(values)
      // Note: Don't close here - the success handler in ClickhouseConnectionContainer
      // will save the data and close the modal only if connection test succeeds
    }
    return
  }

  // For non-standalone mode (regular pipeline creation flow)
  if (onTestConnection) {
    await onTestConnection(values)
  }
}
```

**`ClickhouseConnectionContainer.tsx`** - Added dirty marking (lines 100-106):

```typescript
const saveConnectionData = (values: ClickhouseConnectionFormType) => {
  // Save the connection details to the store only after successful test
  const newConnection = {
    /* ... */
  }
  setClickhouseConnection(newConnection)

  // ✅ If in standalone edit mode, mark configuration as dirty
  if (standalone && toggleEditMode) {
    const { coreStore } = useStore.getState()
    coreStore.markAsDirty()
    console.log('[ClickhouseConnection] Configuration marked as dirty - changes will be saved on Resume')
  }

  // Proceed to next step or close modal
  if (!standalone && onCompleteStep) {
    onCompleteStep(StepKeys.CLICKHOUSE_CONNECTION)
  } else if (standalone && onCompleteStandaloneEditing) {
    onCompleteStandaloneEditing() // ✅ Only called if connection succeeded!
  }
}
```

## 🔄 Flow Comparison

### Before (Broken)

```
User clicks "Save changes"
  ↓
Form Manager: submitFormValues()
  ↓
Call onTestConnection(values)
  ↓
┌─────────────────────────────────────────┐
│ Test starts...                          │
│  - Spinner shows                        │
│  - Connection to ClickHouse...          │
│                                         │
│ Test FAILS (wrong port/credentials)    │
│  ❌ Error returned but ignored         │
└─────────────────────────────────────────┘
  ↓
❌ Mark as dirty (always executed)
❌ Close modal (always executed)
  ↓
Result:
  ❌ Invalid connection saved
  ❌ No error shown to user
  ❌ Form closed
  ❌ User confused!
```

### After (Fixed)

```
User clicks "Save changes"
  ↓
Form Manager: submitFormValues()
  ↓
Call onTestConnection(values)
  ↓
┌─────────────────────────────────────────┐
│ Container: handleTestConnection()      │
│  ↓                                      │
│ Hook: testConnection()                 │
│  ↓                                      │
│ API: /ui-api/clickhouse/test-connection│
│  ↓                                      │
│ ClickHouse connection attempt...       │
└─────────────────────────────────────────┘
  ↓
IF SUCCESS:
  ✅ Hook sets connectionStatus = 'success'
  ✅ Container calls saveConnectionData()
  ✅ Save to store
  ✅ Mark as dirty
  ✅ Close modal
  ✅ Show success message
  ↓
  User sees: "Successfully connected to ClickHouse!" ✅

IF FAILURE:
  ❌ Hook sets connectionStatus = 'error'
  ❌ Hook sets connectionError = "Connection refused" (or actual error)
  ❌ Container does NOT call saveConnectionData()
  ❌ Form stays open
  ⚠️  Error message shown to user
  ↓
  User sees: "Connection failed: Unable to connect to ClickHouse at localhost:8124" ❌
  User can: Fix the error and try again OR click "Discard"
```

## 🎯 Test Scenarios

### Scenario 1: Valid Connection Edit

```
Steps:
1. Edit ClickHouse connection section
2. Change httpPort from "8123" to "9000" (valid port)
3. Click "Save changes"

Expected:
  ✅ Spinner shows "Testing..."
  ✅ Connection test succeeds
  ✅ Success message: "Successfully connected to ClickHouse!"
  ✅ Form closes
  ✅ Configuration marked as dirty
  ✅ Can click "Resume" to apply changes

Console:
  [ClickhouseConnection] Configuration marked as dirty - changes will be saved on Resume
```

### Scenario 2: Invalid Port Edit

```
Steps:
1. Edit ClickHouse connection section
2. Change httpPort from "8123" to "9999" (invalid port)
3. Click "Save changes"

Expected:
  ✅ Spinner shows "Testing..."
  ❌ Connection test fails
  ⚠️  Error message: "Connection failed: Connection refused"
  ❌ Form STAYS OPEN (doesn't close)
  ❌ Invalid connection NOT saved
  ❌ Configuration NOT marked as dirty
  ✅ User can fix the port and try again
  ✅ User can click "Discard" to cancel

Console:
  [ClickHouse] Connection failed: connect ECONNREFUSED localhost:9999
```

### Scenario 3: Wrong Credentials Edit

```
Steps:
1. Edit ClickHouse connection section
2. Change username from "default" to "wronguser"
3. Click "Save changes"

Expected:
  ✅ Spinner shows "Testing..."
  ❌ Connection test fails
  ⚠️  Error message: "Connection failed: Authentication failed"
  ❌ Form STAYS OPEN
  ❌ Invalid credentials NOT saved
  ✅ User can fix credentials and try again
```

### Scenario 4: Discard Invalid Changes

```
Steps:
1. Edit ClickHouse connection section
2. Change httpPort to invalid value "9999"
3. Click "Save changes" → Error shown, form stays open
4. Click "Discard"

Expected:
  ✅ Form resets to original valid values
  ✅ Form closes
  ✅ No changes saved
  ✅ Can edit again if needed
```

### Scenario 5: Correct After Error

```
Steps:
1. Edit ClickHouse connection section
2. Change httpPort to "9999" (invalid)
3. Click "Save changes" → Error: "Connection refused"
4. Fix httpPort to "8123" (valid)
5. Click "Save changes" again

Expected:
  ✅ First attempt: Error shown, form stays open
  ✅ Second attempt: Connection succeeds
  ✅ Success message shown
  ✅ Form closes
  ✅ Valid connection saved
```

## 🔍 Error Messages

The user will see clear, actionable error messages:

| Error Type        | User Message                                | Form Behavior |
| ----------------- | ------------------------------------------- | ------------- |
| Wrong port        | "Connection failed: Connection refused"     | Stays open    |
| Wrong host        | "Connection failed: Unable to resolve host" | Stays open    |
| Wrong credentials | "Connection failed: Authentication failed"  | Stays open    |
| Network timeout   | "Connection failed: Connection timeout"     | Stays open    |
| SSL error         | "Connection failed: SSL handshake failed"   | Stays open    |
| General error     | "Connection failed: [specific error]"       | Stays open    |

In all cases:

- ❌ Invalid connection NOT saved to store
- 📋 Form remains open for correction
- ⚠️ Error message clearly displayed
- 🔄 User can retry with corrected values
- ↩️ User can click "Discard" to cancel

## 📦 Files Changed

1. **`ClickhouseConnectionFormManager.tsx`** (lines 148-180)
   - Simplified `submitFormValues` logic
   - Always test connection in standalone mode
   - Don't close modal in form manager (let container handle it)
   - Removed premature `markAsDirty()` and `onClose()` calls

2. **`ClickhouseConnectionContainer.tsx`** (lines 100-106)
   - Added `markAsDirty()` in `saveConnectionData`
   - Only called when connection test succeeds
   - Ensures dirty flag set for backend update on Resume

## 🎯 Result

The ClickHouse connection editing flow now:

- ✅ **Tests connection** before saving
- ✅ **Shows errors** clearly to user
- ✅ **Keeps form open** on failure
- ✅ **Only saves valid** connection details
- ✅ **Marks as dirty** only on success
- ✅ **Closes modal** only on success
- ✅ **Allows retry** after fixing errors

This matches the Kafka connection flow and provides a much better user experience! 🚀

## 🔗 Related

This fix is identical to the **Kafka Connection Test on Edit** fix, ensuring consistent behavior across all connection forms.

Both connection forms now:

1. Test the connection when editing
2. Show errors if test fails
3. Keep form open for correction
4. Only save valid connections
5. Mark as dirty on success
6. Close modal on success

Consistent UX across the entire application! 🎉
