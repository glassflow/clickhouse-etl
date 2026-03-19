# ClickHouse Connection Module Documentation

## Overview

The ClickHouse Connection module handles all aspects of establishing and managing connections to ClickHouse databases within the application. It provides a comprehensive form-based interface for configuring direct connections with SSL support, certificate verification options, and connection testing capabilities.

## Architecture

### Component Hierarchy

```
ClickhouseConnectionContainer (Container Component)
├── ClickhouseConnectionFormManager (Form Management)
│   ├── ClickhouseConnectionFormRenderer (Form Rendering)
│   │   └── ClickhouseDirectConnectionForm (Direct Connection Fields)
│   │       ├── Host Input
│   │       ├── HTTP(S) Port Input
│   │       ├── Username Input
│   │       ├── Password Input
│   │       ├── Native Port Input
│   │       ├── Use SSL Toggle
│   │       └── Skip Certificate Verification Toggle
│   │
│   └── FormActions (Submit, Discard, etc.)
│
└── Hooks & Utilities
    ├── useClickhouseConnection (Connection Testing)
    ├── useStore (State Management - clickhouseConnectionStore)
    ├── useJourneyAnalytics (Analytics Tracking)
    └── ClickhouseService (Backend Service)
```

## Core Components

### 1. ClickhouseConnectionContainer

**Location:** `src/modules/clickhouse/ClickhouseConnectionContainer.tsx`

**Purpose:** The main container component that orchestrates the ClickHouse connection flow. It manages state, handles connection testing, saves connection data, and coordinates with the store.

**Key Responsibilities:**
- Manages connection state from the global store (`clickhouseConnectionStore`)
- Handles connection testing via `useClickhouseConnection` hook
- Saves connection data to the store only after successful connection test
- Tracks analytics events for connection attempts, successes, and failures
- Handles invalidation of dependent sections (mapper) when connection changes
- Supports both standalone (edit mode) and integrated (pipeline creation) flows
- Manages form state initialization from store values

**Key Functions:**

#### `saveConnectionData(values: ClickhouseConnectionFormType)`
Saves the connection configuration to the store only after a successful connection test. In standalone mode, it also:
- Marks the core store as dirty (indicating changes need to be sent to backend)
- Invalidates the ClickHouse destination/mapper section to ensure reconfiguration

```typescript
const saveConnectionData = (values: ClickhouseConnectionFormType) => {
  const newConnection = {
    ...clickhouseConnection,
    directConnection: {
      host: values.directConnection.host,
      httpPort: values.directConnection.httpPort,
      username: values.directConnection.username,
      password: values.directConnection.password,
      nativePort: values.directConnection.nativePort,
      useSSL: values.directConnection.useSSL,
      skipCertificateVerification: values.directConnection.skipCertificateVerification,
    },
    connectionStatus: 'success' as const,
    connectionError: null,
  }
  setClickhouseConnection(newConnection)
  
  // Handle standalone mode invalidation
  if (standalone && toggleEditMode) {
    const { coreStore, clickhouseDestinationStore } = useStore.getState()
    coreStore.markAsDirty()
    clickhouseDestinationStore.markAsInvalidated(StepKeys.CLICKHOUSE_CONNECTION)
  }
}
```

#### `handleTestConnection(values: ClickhouseConnectionFormType)`
Initiates connection testing, tracks analytics, and saves data only on success. The connection test must return both `success: true` and a non-empty `databases` array.

```typescript
const handleTestConnection = async (values: ClickhouseConnectionFormType) => {
  // Track connection attempt
  analytics.clickhouse.started({
    host: values.directConnection.host,
    useSSL: values.directConnection.useSSL,
  })
  
  // Test the connection
  const result = await testConnection({
    host: values.directConnection.host,
    httpPort: values.directConnection.httpPort,
    username: values.directConnection.username,
    password: values.directConnection.password,
    nativePort: values.directConnection.nativePort,
    useSSL: values.directConnection.useSSL,
    skipCertificateVerification: values.directConnection.skipCertificateVerification,
  })
  
  // Only save if connection was successful and databases are available
  if (result?.success && result.databases?.length > 0) {
    saveConnectionData(values)
  }
}
```

#### `handleDiscardConnectionChange()`
Resets the connection status to idle and clears error messages when the user discards changes.

**State Management:**
- Reads from `clickhouseConnectionStore` for current connection state
- Updates `clickhouseConnectionStore` with new connection data
- Marks `coreStore` as dirty in standalone mode
- Invalidates `clickhouseDestinationStore` when connection changes

**Props:**
```typescript
{
  onCompleteStep?: (step: StepKeys) => void
  onCompleteStandaloneEditing?: () => void
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
}
```

**Analytics Tracking:**
- Tracks page view when user visits the connection step
- Tracks connection started event when test is initiated
- Tracks connection success event when test succeeds
- Tracks connection failed event when test fails

### 2. ClickhouseConnectionFormManager

**Location:** `src/modules/clickhouse/components/ClickhouseConnectionFormManager.tsx`

**Purpose:** Manages the form state using React Hook Form, handles form validation with Zod schema, and coordinates form submission.

**Key Responsibilities:**
- Initializes form with values from store (for returning users)
- Manages form validation using `ClickhouseConnectionFormSchema`
- Handles form field watching and state tracking
- Manages user interaction state to control when validation errors are shown
- Coordinates form submission and connection testing
- Handles form reset/discard functionality

**Key Features:**

#### Form Initialization
The form manager intelligently initializes form values:
- For new forms: Uses default values (useSSL: true, skipCertificateVerification: true)
- For returning forms: Restores values from store (host, ports, username, password, SSL settings)

```typescript
useEffect(() => {
  if (isReturningToForm && !formInitialized.current) {
    if (host) setValue('directConnection.host', host)
    if (httpPort) setValue('directConnection.httpPort', httpPort)
    if (username) setValue('directConnection.username', username)
    if (password) setValue('directConnection.password', password)
    if (nativePort) setValue('directConnection.nativePort', nativePort)
    if (useSSL !== undefined) setValue('directConnection.useSSL', useSSL)
    if (skipCertificateVerification !== undefined)
      setValue('directConnection.skipCertificateVerification', skipCertificateVerification)
    
    formInitialized.current = true
  }
}, [host, httpPort, username, password, nativePort, useSSL, skipCertificateVerification, setValue])
```

#### Validation Error Display
Validation errors are only shown when:
- User has interacted with the form (`userInteracted` is true), OR
- User is returning to a previously filled form and has touched fields

This prevents showing errors before the user has had a chance to fill in the form.

#### Form Submission
```typescript
const submitFormValues = async () => {
  const values = formMethods.getValues()
  setUserInteracted(true)
  
  // Trigger validation
  const result = await formMethods.trigger()
  if (!result) return
  
  // Test connection (both standalone and regular modes)
  if (onTestConnection) {
    await onTestConnection(values)
  }
}
```

**Props:**
```typescript
{
  onTestConnection: (values: ClickhouseConnectionFormType) => Promise<void>
  onDiscardConnectionChange: () => void
  isConnecting: boolean
  connectionResult: { success: boolean; message: string } | null
  readOnly?: boolean
  standalone?: boolean
  initialValues: ClickhouseConnectionFormType
  host: string
  httpPort: string
  username: string
  password: string
  nativePort: string
  useSSL: boolean
  skipCertificateVerification: boolean
  toggleEditMode?: () => void
  pipelineActionState?: any
  onClose?: () => void
}
```

### 3. ClickhouseConnectionFormRenderer

**Location:** `src/modules/clickhouse/components/ClickhouseConnectionFormRenderer.tsx`

**Purpose:** Renders the actual form fields using the form configuration and UI components.

**Key Responsibilities:**
- Renders form fields based on `ClickhouseConnectionFormConfig`
- Handles field registration with React Hook Form
- Displays validation errors
- Supports read-only mode
- Handles loading state (disables fields during connection test)

**Form Fields:**
- **Host**: Text input for ClickHouse server hostname
- **HTTP(S) Port**: Text input for HTTP/HTTPS port (default: 8443)
- **Username**: Text input for authentication username
- **Password**: Password input for authentication password
- **Native Port**: Text input for native protocol port (default: 9440)
- **Use SSL**: Boolean toggle (default: true)
- **Skip Certificate Verification**: Boolean toggle (default: true)

**Layout:**
Fields are arranged in a responsive grid:
- First row: Host, HTTP(S) Port
- Second row: Username, Password
- Third row: Native Port
- Fourth row: Use SSL, Skip Certificate Verification

### 4. useClickhouseConnection Hook

**Location:** `src/hooks/useClickhouseConnection.ts`

**Purpose:** Provides a unified interface for all ClickHouse connection-related operations, including connection testing, database access testing, and table access testing.

**Key Functions:**

#### `testConnection(connectionConfig)`
Tests the basic connection to ClickHouse and retrieves available databases.

**Parameters:**
```typescript
{
  host: string
  httpPort: string
  username: string
  password: string
  nativePort?: string
  useSSL?: boolean
  skipCertificateVerification?: boolean
  connectionType?: 'direct' | 'proxy' | 'connectionString'
  database?: string
}
```

**Returns:**
```typescript
{
  success: boolean
  databases?: string[]
  error?: string
}
```

**Flow:**
1. Sets loading state to true
2. Sends POST request to `/ui-api/clickhouse/test-connection` with `testType: 'connection'`
3. On success:
   - Updates store connection status
   - Updates databases in metadata store
   - Tracks success analytics
   - Returns success with databases array
4. On failure:
   - Sets error state
   - Shows notification with retry option
   - Tracks failure analytics
   - Returns error

#### `testDatabaseAccess(connectionConfig)`
Tests access to a specific database and retrieves available tables.

**Parameters:**
```typescript
{
  host: string
  httpPort: string
  username: string
  password: string
  database: string
  nativePort?: string
  useSSL?: boolean
  skipCertificateVerification?: boolean
}
```

**Returns:**
```typescript
{
  success: boolean
  tables?: string[]
  error?: string
}
```

#### `testTableAccess(connectionConfig)`
Tests access to a specific table and retrieves a sample row.

**Parameters:**
```typescript
{
  host: string
  httpPort: string
  username: string
  password: string
  database: string
  table: string
  nativePort?: string
  useSSL?: boolean
  skipCertificateVerification?: boolean
}
```

**Returns:**
```typescript
{
  success: boolean
  sample?: any[]
  error?: string
}
```

**State Management:**
- Maintains local state for `isLoading`, `connectionStatus`, and `connectionError`
- Updates `clickhouseConnectionStore` on successful connections
- Updates `clickhouseMetadata` with databases, tables, and schemas

**Error Handling:**
- Shows user-friendly notifications via `notify()` function
- Provides retry functionality in error notifications
- Tracks all errors via analytics

### 5. ClickhouseConnectionStore

**Location:** `src/store/clickhouse-connection.store.ts`

**Purpose:** Manages the global state for ClickHouse connection configuration and metadata.

**State Structure:**

```typescript
interface ClickhouseConnectionStore {
  // Connection configuration
  clickhouseConnection: ClickhouseConnectionFormType
  
  // Metadata (databases, tables, schemas)
  clickhouseMetadata: ClickHouseMetadata | null
  
  // Validation state
  validation: ValidationState
}
```

**ClickHouseMetadata Structure:**
```typescript
interface ClickHouseMetadata {
  lastFetched: number
  connectionId: string
  databases?: string[]
  tables?: Record<string, string[]> // database -> tables mapping
  tableSchemas?: Record<string, any[]> // "database:table" -> schema mapping
}
```

**Key Actions:**

#### `setClickhouseConnection(connector)`
Updates the connection configuration. If connection details (host, port, username, password) have changed:
- Resets `clickhouseMetadata` to null (clears cached databases/tables)
- Updates validation state based on connection status

#### `updateDatabases(databases, connectionId)`
Updates the list of available databases for the current connection.

#### `updateTables(database, tables, connectionId)`
Updates the list of tables for a specific database.

#### `updateTableSchema(database, table, schema, connectionId)`
Updates the schema information for a specific table.

#### `clearMetadata()`
Clears all cached metadata (databases, tables, schemas).

**Getters:**

- `getDatabases()`: Returns array of database names
- `getTables(database)`: Returns array of table names for a database
- `getTableSchema(database, table)`: Returns schema array for a table
- `getConnectionId()`: Returns the current connection ID
- `getIsClickhouseConnectionDirty()`: Checks if connection has been configured

**Validation Methods:**
- `markAsValid()`: Marks connection as valid
- `markAsInvalidated(invalidatedBy)`: Marks connection as invalidated by another step
- `markAsNotConfigured()`: Resets to initial validation state
- `resetValidation()`: Resets validation state

**Connection ID Generation:**
The connection ID is generated as `${host}:${httpPort}` and is used to:
- Track which connection the metadata belongs to
- Invalidate metadata when connection changes
- Cache metadata per connection

### 6. ClickhouseService

**Location:** `src/services/clickhouse-service.ts`

**Purpose:** Backend service that handles actual ClickHouse connection and query execution.

**Key Methods:**

#### `testConnection({ config, testType, database, table })`
Tests the connection to ClickHouse with different test types:
- `'connection'`: Tests basic connection and returns databases
- `'database'`: Tests database access and returns tables
- `'table'`: Tests table access and returns sample data

**Connection Methods:**
The service supports two connection methods:
1. **Direct HTTP** (for SSL connections): Uses native fetch with custom dispatcher
2. **ClickHouse Client** (for non-SSL connections): Uses @clickhouse/client library

**Error Handling:**
- Catches and formats connection errors
- Returns structured error responses
- Handles connection cleanup

### 7. API Route

**Location:** `src/app/ui-api/clickhouse/test-connection/route.ts`

**Purpose:** Next.js API route that handles connection testing requests from the frontend.

**Endpoint:** `POST /ui-api/clickhouse/test-connection`

**Request Body:**
```typescript
{
  host: string
  httpPort: string
  nativePort?: string
  username: string
  password: string
  database?: string
  table?: string
  useSSL?: boolean
  skipCertificateVerification?: boolean
  connectionType?: 'direct' | 'proxy' | 'connectionString'
  proxyUrl?: string
  connectionString?: string
  testType: 'connection' | 'database' | 'table'
}
```

**Response:**
```typescript
{
  success: boolean
  databases?: string[]
  tables?: string[]
  sample?: any[]
  error?: string
  message?: string
}
```

## Data Flow

### Connection Test Flow

```
User fills form
    ↓
User clicks "Test Connection" or "Continue"
    ↓
ClickhouseConnectionFormManager.submitFormValues()
    ↓
Validates form (Zod schema)
    ↓
ClickhouseConnectionContainer.handleTestConnection()
    ↓
Analytics: clickhouse.started()
    ↓
useClickhouseConnection.testConnection()
    ↓
POST /ui-api/clickhouse/test-connection
    ↓
ClickhouseService.testConnection()
    ↓
createClickHouseConnection() → ClickHouse server
    ↓
Execute query (SHOW DATABASES)
    ↓
Parse response
    ↓
Return result to hook
    ↓
If success:
    - Update store (connection + databases)
    - Analytics: clickhouse.success()
    - saveConnectionData()
    - Proceed to next step
If failure:
    - Set error state
    - Analytics: clickhouse.failed()
    - Show notification
```

### State Persistence Flow

```
User enters connection details
    ↓
Form state (React Hook Form) - Local component state
    ↓
User tests connection
    ↓
Connection succeeds
    ↓
saveConnectionData()
    ↓
clickhouseConnectionStore.setClickhouseConnection()
    ↓
Zustand store persists in memory
    ↓
On page reload/navigation:
    - Store values used to initialize form
    - Form shows previous connection details
```

## Form Schema

**Location:** `src/scheme/clickhouse.scheme.ts`

The form uses Zod for validation:

```typescript
const DirectConnectionSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  httpPort: z.string().min(1, 'HTTP(S) Port is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  nativePort: z.string().min(1, 'Native Port is required'),
  useSSL: z.boolean().optional(),
  skipCertificateVerification: z.boolean().optional(),
})

const ClickhouseConnectionFormSchema = z.object({
  connectionType: z.literal('direct'),
  directConnection: DirectConnectionSchema,
  connectionStatus: z.enum(['idle', 'loading', 'success', 'error']).optional(),
  connectionError: z.string().nullable().optional(),
})
```

## Form Configuration

**Location:** `src/config/clickhouse-connection-form-config.ts`

Defines the form field configurations including:
- Field names (matching schema paths)
- Labels
- Placeholders
- Required validation messages
- Field types
- Default values

## Analytics Integration

**Location:** `src/hooks/useJourneyAnalytics.ts`

The module tracks the following analytics events:

### Page View
- **Event:** `setupClickhouseConnection`
- **Properties:**
  - `isReturningVisit`: boolean (whether user has previously configured connection)

### Connection Started
- **Event:** `ClickhouseConnection_Started`
- **Properties:**
  - `host`: string
  - `useSSL`: boolean

### Connection Success
- **Event:** `ClickhouseConnection_Success`
- **Properties:**
  - `host`: string
  - `useSSL`: boolean
  - `databaseCount`: number (from testConnection)

### Connection Failed
- **Event:** `ClickhouseConnection_Failed`
- **Properties:**
  - `host`: string
  - `error`: string

## Dependencies

### Internal Dependencies

1. **Store:**
   - `clickhouseConnectionStore`: Connection state and metadata
   - `clickhouseDestinationStore`: Destination configuration (invalidated on connection change)
   - `coreStore`: Pipeline state and dirty flag

2. **Hooks:**
   - `useClickhouseConnection`: Connection testing
   - `useJourneyAnalytics`: Analytics tracking
   - `useStore`: Zustand store access

3. **Components:**
   - `FormActions`: Submit/discard buttons
   - `FormEditActionButtonGroup`: Edit mode buttons
   - `FormGroup`: Form layout wrapper
   - `renderFormField`: Field rendering utility

4. **Services:**
   - `ClickhouseService`: Backend connection service

5. **Schemas:**
   - `ClickhouseConnectionFormSchema`: Form validation
   - `ClickhouseConnectionFormType`: TypeScript types

6. **Config:**
   - `ClickhouseConnectionFormConfig`: Form field definitions
   - `StepKeys`: Step constants

### External Dependencies

- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **@hookform/resolvers**: Zod resolver for React Hook Form
- **@heroicons/react**: Icons (CheckCircleIcon, XCircleIcon)
- **Zustand**: State management

## Usage Patterns

### Standalone Mode (Edit Mode)

When editing an existing pipeline:

```typescript
<ClickhouseConnectionContainer
  standalone={true}
  readOnly={false}
  toggleEditMode={toggleEditMode}
  onCompleteStandaloneEditing={handleClose}
  pipelineActionState={pipelineActionState}
/>
```

**Behavior:**
- Form initialized with existing connection from store
- Changes marked as dirty in coreStore
- Dependent sections (mapper) invalidated on connection change
- Modal closes on successful connection test

### Integrated Mode (Pipeline Creation)

When creating a new pipeline:

```typescript
<ClickhouseConnectionContainer
  standalone={false}
  onCompleteStep={handleStepComplete}
/>
```

**Behavior:**
- Form starts with default values
- Proceeds to next step on successful connection
- No dirty flag management
- No invalidation of other sections

### Read-Only Mode

When viewing a pipeline:

```typescript
<ClickhouseConnectionContainer
  readOnly={true}
  standalone={false}
/>
```

**Behavior:**
- All form fields disabled
- No test connection functionality
- No save/discard actions

## Error Handling

### Connection Errors

1. **Network Errors:**
   - Caught in `useClickhouseConnection.testConnection()`
   - Error message displayed in connection result
   - Notification shown with retry option
   - Analytics event tracked

2. **Authentication Errors:**
   - Returned from ClickHouse server
   - Parsed and displayed to user
   - Connection status set to 'error'

3. **Validation Errors:**
   - Handled by React Hook Form + Zod
   - Displayed inline on form fields
   - Prevents form submission

### State Recovery

- **Discard Changes:** Resets form to original store values
- **Connection Reset:** Sets connection status to 'idle' and clears errors
- **Metadata Invalidation:** Clears cached data when connection changes

## Best Practices

1. **Always test connection before saving:** The container only saves connection data after a successful test.

2. **Handle connection changes:** When connection details change, invalidate dependent sections to ensure data consistency.

3. **Track analytics:** All connection attempts, successes, and failures should be tracked for user journey analysis.

4. **Show loading states:** Disable form fields and show loading indicators during connection tests.

5. **Provide retry options:** Error notifications should include retry functionality.

6. **Validate before testing:** Form validation should complete before attempting connection test.

7. **Cache metadata per connection:** Use connection ID to cache databases/tables per connection.

8. **Clear metadata on connection change:** When host, port, username, or password changes, clear cached metadata.

## Future Enhancements

Potential improvements for the ClickHouse connection module:

1. **Connection Types:**
   - Proxy connection support
   - Connection string support

2. **Connection Pooling:**
   - Reuse connections for better performance
   - Connection health monitoring

3. **Advanced SSL Options:**
   - Custom certificate upload
   - Certificate chain validation

4. **Connection History:**
   - Save recent connections
   - Quick connection selection

5. **Connection Validation:**
   - Pre-flight checks
   - Connection timeout configuration

6. **Multi-Database Support:**
   - Test multiple databases at once
   - Database selection UI
