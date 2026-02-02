# Kafka Connection Module Documentation

## Overview

The Kafka Connection module handles all aspects of establishing and managing connections to Kafka clusters within the application. It provides a comprehensive form-based interface for configuring various authentication methods, security protocols, and connection parameters.

**Recent updates (refactor):** Request-body building is centralized in `connectionFormToRequestBody`; save and topic-invalidation logic live in `useKafkaConnectionSave`; auth-specific form components are split into `components/forms/` with a barrel export.

## Architecture

### Component Hierarchy

```
KafkaConnectionContainer (Container Component)
├── useKafkaConnectionSave (Save & Invalidation)
│   └── fetchTopicsForConnection (utils) → connectionFormToRequestBody (utils)
├── KafkaConnectionFormManager (Form Management)
│   ├── KafkaConnectionFormRenderer (Form Rendering)
│   │   ├── KafkaBaseForm (Base Fields - Always Visible)
│   │   │   ├── Auth Method Selector
│   │   │   ├── Security Protocol Selector
│   │   │   └── Bootstrap Servers Input
│   │   │
│   │   └── Auth-Specific Forms (from components/forms/)
│   │       ├── NoAuthForm
│   │       ├── SaslPlainForm
│   │       ├── SaslJaasForm
│   │       ├── SaslGssapiForm
│   │       ├── SaslOauthbearerForm
│   │       ├── SaslScram256Form
│   │       ├── SaslScram512Form
│   │       ├── AwsIamForm
│   │       ├── MtlsForm
│   │       ├── DelegationTokensForm
│   │       ├── LdapForm
│   │       └── TruststoreForm (Conditional - SSL/SASL_SSL)
│   │
│   └── FormActions (Submit, Discard, etc.)
│
└── Hooks & Utilities
    ├── useKafkaConnection (Connection Testing; uses connectionFormToRequestBody)
    ├── useKafkaConnectionSave (Save to store, topic diff, dependent invalidation)
    ├── useStore (State Management)
    ├── useJourneyAnalytics (Analytics Tracking)
    ├── usePipelineActions (Pipeline Operations)
    └── Utils: connectionFormToRequestBody, fetchTopicsForConnection
```

## Core Components

### 1. KafkaConnectionContainer

**Location:** `src/modules/kafka/KafkaConnectionContainer.tsx`

**Purpose:** The main container component that orchestrates the Kafka connection flow. It composes hooks for connection testing and saving, manages initial values and bootstrap change detection, and coordinates analytics.

**Key Responsibilities:**

- Reads connection state from `kafkaStore` for initial values
- Handles connection testing via `useKafkaConnection` hook
- Saves connection data via `useKafkaConnectionSave` hook (which performs store sync, topic diff, and dependent invalidation)
- Monitors bootstrap server changes and resets `topicsStore`
- Tracks analytics events for connection attempts
- Supports both standalone (edit mode) and integrated (pipeline creation) flows

**Key Functions:**

#### `handleTestConnection(values: KafkaConnectionFormType)`

Initiates connection testing, tracks analytics, and on success calls `saveConnectionData(values)` from `useKafkaConnectionSave`.

**State Management:**

- Reads from `kafkaStore` for initial form values and bootstrap change detection
- Resets `topicsStore` when bootstrap servers change (via `previousBootstrapServers` ref)
- All store updates and dependent invalidation are performed inside `useKafkaConnectionSave.saveConnectionData`

**Props:** Typed via `KafkaConnectionContainerProps`:

```typescript
{
  steps?: Record<string, { key?: string; title?: string; description?: string }>
  onCompleteStep?: (step: StepKeys) => void
  validate: () => Promise<boolean>
  standalone?: boolean
  readOnly?: boolean
  toggleEditMode?: (apiConfig?: unknown) => void
  onCompleteStandaloneEditing?: () => void
  pipelineActionState?: PipelineActionState  // from usePipelineActions
  pipeline?: Pipeline                      // from @/src/types/pipeline
}
```

### 2. KafkaConnectionFormManager

**Location:** `src/modules/kafka/components/KafkaConnectionFormManager.tsx`

**Purpose:** Manages the form state using React Hook Form, handles form validation, and coordinates form submission.

**Key Features:**

- Uses `react-hook-form` with Zod validation (`KafkaConnectionFormSchema`)
- Auto-selects security protocol based on auth method selection
- Tracks user interaction to control when validation errors are shown
- Handles form initialization when returning to a previously filled form
- Manages discard functionality to reset form to original values

**Form Configuration:**

- **Mode:** `onBlur` - validates fields when they lose focus
- **Criteria Mode:** `firstError` - shows first error per field
- **Focus Error:** `false` - doesn't auto-focus on errors

**Auto-Selection Logic:**
When a user changes the auth method, the security protocol is automatically set:

- `SASL/SCRAM-256` or `SASL/SCRAM-512` → `SASL_SSL`
- `SASL/PLAIN` → `SASL_PLAINTEXT`
- `NO_AUTH` → `PLAINTEXT`
- `SASL/JAAS` → `SASL_JAAS`
- `SASL/GSSAPI` → `SASL_GSSAPI`

**Validation Display:**
Validation errors are only shown when:

- User has interacted with the form (`userInteracted` state), OR
- Returning to a previously filled form with touched fields

**Submission Flow:**

1. User clicks "Continue" or submits form
2. Form validation is triggered manually
3. If validation passes:
   - In standalone mode: Always test connection, save only on success
   - In non-standalone mode: Test connection and proceed

### 3. KafkaConnectionFormRenderer

**Location:** `src/modules/kafka/components/KafkaConnectionFormRenderer.tsx`

**Purpose:** Renders the appropriate form fields based on the selected authentication method and security protocol.

**Rendering Logic:**

1. **Base Form:** Always rendered with:
   - Auth Method selector
   - Security Protocol selector (options filtered based on auth method)
   - Bootstrap Servers input

2. **Auth-Specific Form:** Conditionally rendered based on `authMethod`:
   - Uses a switch statement to render the appropriate form component
   - Each auth method has its own form component in `components/forms/` (see Form Variants below)

3. **Truststore Form:** Conditionally rendered when:
   - Security protocol is `SASL_SSL` or `SSL`
   - And the auth method supports truststore (SASL/PLAIN, SASL/GSSAPI, SASL/SCRAM-256, SASL/SCRAM-512, NO_AUTH)

**Security Protocol Options:**

- For SCRAM auth methods: Only SASL protocols are available
- For other auth methods: All security protocols are available

### 4. Form Variants (components/forms/)

**Location:** `src/modules/kafka/components/forms/`

**Purpose:** Auth method-specific form components, split into one file per form with a barrel export. The renderer imports from `./forms` (see `forms/index.ts`).

**Structure:**

- `formUtils.ts` – `getFieldError(errors, path)` for nested field errors
- `TruststoreForm.tsx` – Shared truststore UI (certificates, skip TLS); used by NoAuth, SaslPlain, SaslGssapi, SaslScram256, SaslScram512
- One file per auth form: `SaslPlainForm.tsx`, `NoAuthForm.tsx`, `SaslJaasForm.tsx`, `SaslGssapiForm.tsx`, `SaslOauthbearerForm.tsx`, `SaslScram256Form.tsx`, `SaslScram512Form.tsx`, `AwsIamForm.tsx`, `MtlsForm.tsx`, `DelegationTokensForm.tsx`, `LdapForm.tsx`
- `index.ts` – Re-exports all form components

**Available Forms:**

#### NoAuthForm

- Renders truststore fields when SSL/SASL_SSL is selected
- No additional authentication fields

#### SaslPlainForm

- Username and password fields
- Consumer group field
- Truststore fields (conditional on SSL/SASL_SSL)

#### SaslJaasForm

- JAAS configuration textarea

#### SaslGssapiForm

- Kerberos principal, realm, KDC, service name
- File upload for Kerberos keytab (base64 encoded)
- File upload for krb5.conf configuration
- Truststore fields (conditional on SSL/SASL_SSL)

#### SaslOauthbearerForm

- OAuth bearer token field

#### SaslScram256Form / SaslScram512Form

- Username and password fields
- Consumer group field
- Truststore fields (conditional on SSL/SASL_SSL)

#### AwsIamForm

- AWS access key, secret key, and region fields

#### MtlsForm

- Client certificate, client key, and password fields

#### DelegationTokensForm

- Delegation token field

#### LdapForm

- LDAP server URL, port, bind DN, bind password
- User search filter and base DN

#### TruststoreForm

- Certificate file upload (with textarea fallback)
- Skip TLS verification checkbox
- Supports different auth method prefixes for nested form paths

## Hooks

### useKafkaConnection

**Location:** `src/hooks/useKafkaConnection.ts`

**Purpose:** Provides connection testing functionality. Uses the shared `connectionFormToRequestBody` utility to build the request body (single source of truth for API payload).

**API:**

```typescript
{
  testConnection: (values: KafkaConnectionFormType) => Promise<{success: boolean, message: string}>
  isConnecting: boolean
  connectionResult: {success: boolean, message: string} | null
  kafkaConnection: KafkaConnectionFormType | null
}
```

**Connection Testing Flow:**

1. Sets `isConnecting` to `true`
2. Builds request body via `connectionFormToRequestBody(values)` (see Utils below)
3. Sends POST request to `/ui-api/kafka/`
4. On success: returns success result, updates local state, shows success notification
5. On failure: returns error result, shows notification via `notify()`, updates local state

### useKafkaConnectionSave

**Location:** `src/modules/kafka/hooks/useKafkaConnectionSave.ts`

**Purpose:** Encapsulates save-to-store logic, topic diff in standalone mode, and dependent section invalidation. Used by `KafkaConnectionContainer` after a successful connection test.

**API:**

```typescript
useKafkaConnectionSave({
  standalone?: boolean
  toggleEditMode?: (apiConfig?: unknown) => void
  onCompleteStep?: (step: StepKeys) => void
  onCompleteStandaloneEditing?: () => void
}) => { saveConnectionData: (values: KafkaConnectionFormType) => Promise<void> }
```

**saveConnectionData behavior:**

- In standalone mode: calls `fetchTopicsForConnection(values)`, compares with current `availableTopics`; if topics changed, sets `shouldInvalidateDependents`
- Writes to store: `setKafkaConnection`, `setKafkaAuthMethod`, `setKafkaSecurityProtocol`, `setKafkaBootstrapServers`, and the appropriate auth-specific setter (e.g. `setKafkaNoAuth`, `setKafkaSaslPlain`) using type-safe `'in'` narrowing on the discriminated union
- In standalone mode: `coreStore.markAsDirty()`; if `shouldInvalidateDependents`, invalidates `topicsStore`, `joinStore`, `deduplicationStore`, `clickhouseDestinationStore` for `StepKeys.KAFKA_CONNECTION`
- Calls `onCompleteStep(StepKeys.KAFKA_CONNECTION)` or `onCompleteStandaloneEditing()` as appropriate

## Utils (Request Body & Fetch Topics)

### connectionFormToRequestBody

**Location:** `src/modules/kafka/utils/connectionToRequestBody.ts`

**Purpose:** Single source of truth for mapping `KafkaConnectionFormType` to the request payload for `POST /ui-api/kafka/` and `POST /ui-api/kafka/topics`. Used by `useKafkaConnection.testConnection` and by `fetchTopicsForConnection`.

**API:** `connectionFormToRequestBody(values: KafkaConnectionFormType): KafkaConnectionRequestBody`

**Request body shape:** Includes `servers`, `securityProtocol`, `authMethod`, `skipTlsVerification` (when applicable), plus auth-specific fields per method (e.g. NO_AUTH: certificate; SASL/PLAIN: username, password, consumerGroup, certificate; etc.). Adding or changing an auth method requires updating this utility and the schema/config only.

### fetchTopicsForConnection

**Location:** `src/modules/kafka/utils/fetchTopicsForConnection.ts`

**Purpose:** Fetches available topics from the Kafka cluster using connection form values. Uses `connectionFormToRequestBody` and `POST /ui-api/kafka/topics`. Used by `useKafkaConnectionSave` when in standalone mode to compare topics before/after connection change.

## State Management

### KafkaStore

**Location:** `src/store/kafka.store.ts`

**Purpose:** Manages all Kafka connection-related state using Zustand.

**State Structure:**

```typescript
{
  // Status
  isConnected: boolean

  // Base connection values
  authMethod: string
  securityProtocol: string
  bootstrapServers: string

  // Auth method-specific data
  saslPlain: SaslPlainFormType
  saslJaas: SaslJaasFormType
  saslGssapi: SaslGssapiFormType
  saslOauthbearer: SaslOauthbearerFormType
  saslScram256: SaslScram256FormType
  saslScram512: SaslScram512FormType
  noAuth: NoAuthFormType
  awsIam: AwsIamFormType
  delegationTokens: DelegationTokensFormType
  ldap: LdapFormType
  mtls: MtlsFormType

  // Validation state
  validation: ValidationState
}
```

**Actions:**

- `setKafkaAuthMethod(authMethod: string)`
- `setKafkaSecurityProtocol(securityProtocol: string)`
- `setKafkaBootstrapServers(bootstrapServers: string)`
- `setKafkaNoAuth(noAuth: NoAuthFormType)`
- `setKafkaSaslPlain(saslPlain: SaslPlainFormType)`
- `setKafkaSaslJaas(saslJaas: SaslJaasFormType)`
- `setKafkaSaslGssapi(saslGssapi: SaslGssapiFormType)`
- `setKafkaSaslOauthbearer(saslOauthbearer: SaslOauthbearerFormType)`
- `setKafkaSaslScram256(saslScram256: SaslScram256FormType)`
- `setKafkaSaslScram512(saslScram512: SaslScram512FormType)`
- `setKafkaAwsIam(awsIam: AwsIamFormType)`
- `setKafkaDelegationTokens(delegationTokens: DelegationTokensFormType)`
- `setKafkaLdap(ldap: LdapFormType)`
- `setKafkaMtls(mtls: MtlsFormType)`
- `setKafkaConnection(connection: KafkaConnectionFormType)` - Sets entire connection and marks as valid
- `setIsConnected(isConnected: boolean)`
- `getIsKafkaConnectionDirty()` - Checks if connection data has changed
- `resetKafkaStore()` - Resets all Kafka store state

## Schema & Validation

### KafkaConnectionFormSchema

**Location:** `src/scheme/kafka.scheme.ts`

**Purpose:** Defines the Zod schema for form validation using a discriminated union pattern.

**Structure:**

- **Base Schema:** Contains common fields (authMethod, securityProtocol, bootstrapServers)
- **Discriminated Union:** Each auth method extends the base schema with its specific fields
- **Super Refine:** Additional validation for certificate requirements based on security protocol

**Validation Rules:**

1. Base fields are always required
2. Auth-specific fields are required based on selected auth method
3. Truststore certificates are required when:
   - Security protocol is `SASL_SSL` or `SSL`
   - And the auth method supports truststore
4. Certificate validation is handled via `.superRefine()` at the schema level

**Type Safety:**
The discriminated union ensures TypeScript knows which fields are available based on the `authMethod` value, providing compile-time type safety.

## Configuration

### KafkaFormConfig

**Location:** `src/config/kafka-connection-form-config.ts`

**Purpose:** Defines form field configurations for all auth methods.

**Structure:**

- `KafkaBaseFormConfig`: Base form fields (authMethod, securityProtocol, bootstrapServers)
- `KafkaFormConfig`: Auth-specific form configurations
- `KafkaFormDefaultValues`: Default values for all form fields

**Field Configuration:**
Each field includes:

- `name`: Form field name (with nested path for auth-specific fields)
- `label`: Display label
- `placeholder`: Input placeholder text
- `required`: Error message if field is required
- `type`: Field type (text, password, textarea, select, etc.)
- `options`: For select fields

## Connection Flow

### Standard Flow (Pipeline Creation)

1. **Initialization:**
   - Component receives initial values from store
   - Form is initialized with defaults merged with store values
   - User sees base form fields

2. **User Input:**
   - User selects auth method
   - Security protocol auto-selects (if applicable)
   - User fills in auth-specific fields
   - Truststore fields appear if SSL/SASL_SSL is selected

3. **Validation:**
   - Form validates on blur
   - Errors shown only after user interaction
   - Schema validation ensures all required fields are present

4. **Connection Test:**
   - User clicks "Continue"
   - Form validation is triggered
   - If valid, `handleTestConnection` is called
   - Connection test is performed via `useKafkaConnection` hook
   - Analytics events are tracked (started, success/failed)

5. **Save & Proceed:**
   - On successful connection:
     - Connection data is saved to store via `saveConnectionData` from `useKafkaConnectionSave`
     - All auth method-specific data is saved; step is completed via `onCompleteStep`
   - On failed connection:
     - Error is displayed
     - User can fix and retry

### Standalone Flow (Edit Mode)

1. **Initialization:**
   - Form is initialized with existing connection data from store
   - `isReturningToForm` flag is set to `true`
   - Auto-selection is skipped to preserve existing values

2. **User Modifications:**
   - User can modify any connection fields
   - Changes are tracked in form state

3. **Connection Test:**
   - User clicks "Save" or "Continue"
   - Connection is tested with new values
   - On success:
     - New topics are fetched and compared with existing topics
     - If topics changed, dependent sections are invalidated
     - Connection data is saved to store
     - Store is marked as dirty (needs backend sync)
     - Modal/form is closed

4. **Dependent Invalidation:**
   - If topics have changed, the following stores are invalidated:
     - `topicsStore`
     - `joinStore`
     - `deduplicationStore`
     - `clickhouseDestinationStore`
   - This ensures dependent configurations are re-evaluated

## Bootstrap Server Change Detection

The container monitors changes to `bootstrapServers` using a `useRef` to avoid unnecessary re-renders:

```typescript
const previousBootstrapServers = useRef(bootstrapServers)

useEffect(() => {
  if (previousBootstrapServers.current !== bootstrapServers) {
    resetTopicsStore() // Clear topics when source changes
    previousBootstrapServers.current = bootstrapServers
  }
}, [bootstrapServers])
```

When bootstrap servers change, the topics store is reset because topics are specific to a Kafka cluster.

## Analytics Integration

The module tracks analytics events via `useJourneyAnalytics`:

- **Page View:** `analytics.page.setupKafkaConnection()` - When user starts entering connection details
- **Connection Started:** `analytics.kafka.started()` - When connection test begins
- **Connection Success:** `analytics.kafka.success()` - When connection test succeeds
- **Connection Failed:** `analytics.kafka.failed()` - When connection test fails

Analytics events include:

- Auth method used
- Security protocol used
- Connection time (for successful connections)
- Error message (for failed connections)

## API Endpoints

### Test Connection

- **Endpoint:** `POST /ui-api/kafka/`
- **Request Body:** Built by `connectionFormToRequestBody(values)` (see Utils above). Same shape for all auth methods; fields vary by auth method.
- **Response:**
  ```typescript
  {
    success: boolean
    error?: string
  }
  ```

### Fetch Topics

- **Endpoint:** `POST /ui-api/kafka/topics`
- **Request Body:** Same as test connection; built by `connectionFormToRequestBody` (used inside `fetchTopicsForConnection`).
- **Response:**
  ```typescript
  {
    success: boolean
    topics?: string[]
    error?: string
  }
  ```

## Error Handling

1. **Form Validation Errors:**
   - Displayed inline with form fields
   - Only shown after user interaction
   - Managed by React Hook Form

2. **Connection Test Errors:**
   - Displayed via notification system
   - Error message shown in connection result
   - User can retry after fixing issues

3. **Topic Fetch Errors:**
   - In standalone mode, if topic fetch fails during save:
     - Conservative approach: Dependent sections are invalidated
     - Ensures data consistency

## File Uploads

The module supports file uploads for:

- **Kerberos Keytab:** Base64 encoded, for SASL/GSSAPI
- **krb5.conf:** Text file, for SASL/GSSAPI
- **Certificates:** Text/PEM format, for truststore

File uploads use the `InputFile` and `CertificateFileUpload` components, which:

- Read file content
- Store content in form state
- Store filename separately
- Support both file upload and manual paste

## Dependencies

### Internal Dependencies

- `@/src/store` - Global state management
- `@/src/scheme` - Form schemas and types
- `@/src/config` - Form configurations and constants
- `@/src/hooks` - Custom hooks (useKafkaConnection, useJourneyAnalytics, usePipelineActions)
- `@/src/modules/kafka/hooks` - useKafkaConnectionSave
- `@/src/modules/kafka/utils` - connectionFormToRequestBody, fetchTopicsForConnection
- `@/src/components/ui` - UI components (FormGroup, form rendering utilities)
- `@/src/components/common` - Common components (InputFile, CertificateFileUpload)

### External Dependencies

- `react-hook-form` - Form state management
- `@hookform/resolvers/zod` - Zod schema validation
- `zustand` - State management
- `react` - React hooks and components

## Best Practices

1. **State Management:**
   - Always use store actions to update Kafka connection state
   - Don't directly mutate store state
   - Use `setKafkaConnection` for bulk updates

2. **Form Validation:**
   - Let React Hook Form handle validation
   - Use Zod schema for type-safe validation
   - Show errors only after user interaction

3. **Connection Testing:**
   - Always test connection before saving
   - Show loading state during connection test
   - Provide clear error messages

4. **Standalone Mode:**
   - Check for topic changes before invalidating dependents
   - Mark store as dirty when changes are made
   - Don't auto-save in standalone mode

5. **Analytics:**
   - Track all connection attempts
   - Include relevant context (auth method, protocol)
   - Track both success and failure cases

## Recent Refactors (Done)

- **Centralized request body:** All API payloads for connection test and fetch topics are built by `connectionFormToRequestBody` (single place to add/change auth methods).
- **Save logic in hook:** `useKafkaConnectionSave` holds save-to-store, topic diff, and dependent invalidation; container stays thin.
- **Typed container props:** `KafkaConnectionContainerProps` with `Pipeline`, `PipelineActionState`; no `any` for steps/validate/pipeline.
- **Form variants split:** Auth-specific forms live in `components/forms/` (one file per form + TruststoreForm + formUtils + barrel). Lazy loading of form chunks is a possible follow-up.
- **TruststoreForm in renderer (Phase 4):** The standalone TruststoreForm block was removed from `KafkaConnectionFormRenderer`; truststore is only rendered inside auth-specific forms (NoAuthForm, SaslPlainForm, SaslGssapiForm, SaslScram256Form, SaslScram512Form) when SSL or SASL_SSL is selected. Documented in a comment in the renderer.

## Future Improvements

1. **Connection Caching:**
   - Cache successful connections
   - Reuse connection info when possible

2. **Connection Validation:**
   - Validate connection before allowing form submission
   - Show connection status indicator

3. **Advanced Error Handling:**
   - More specific error messages
   - Retry mechanisms
   - Connection timeout handling

4. **Performance:**
   - Debounce connection tests
   - Optimize re-renders
   - Lazy load auth form components (e.g. React.lazy + Suspense per auth method)
