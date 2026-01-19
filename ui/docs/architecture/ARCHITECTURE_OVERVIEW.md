# Architecture Overview

## Executive Summary

The ClickHouse ETL UI is a modern Next.js 16 application that provides a comprehensive interface for configuring and managing data pipelines between Kafka and ClickHouse. The application follows a modular architecture with clear separation of concerns, using Zustand for state management, React Hook Form for form handling, and Zod for validation.

## Technology Stack

### Core Framework

- **Next.js 16.0.10** - React framework with App Router
- **React 19.2.3** - UI library
- **TypeScript 5.8.3** - Type safety

### State Management

- **Zustand 5.0.5** - Lightweight state management with slice pattern
- **React Hook Form 7.55.0** - Form state management
- **Zod 3.24.2** - Schema validation

### UI Components

- **Radix UI** - Accessible component primitives (Dialog, Select, Tabs, etc.)
- **Tailwind CSS 4.1.3** - Utility-first CSS framework
- **shadcn/ui** - Component library built on Radix UI
- **Heroicons** - Icon library
- **Lucide React** - Additional icons

### Data Integration

- **KafkaJS 2.2.4** - Kafka client library
- **@clickhouse/client 1.11.0** - ClickHouse client
- **Axios 1.8.4** - HTTP client

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript ESLint** - TypeScript-specific linting

## Application Architecture

### High-Level Structure

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Pages      │  │   API Routes │  │  Middleware  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
        ┌─────────────────-┼─────────────────┐
        │                  │                 │
┌───────▼──────-┐  ┌───────▼──────┐  ┌───────▼──────┐
│   Modules     │  │  Components  │  │    Store     │
│  (Features)   │  │   (UI)       │  │  (State)     │
└───────┬───────┘  └──────┬─────-─┘  └───────┬──────┘
        │                 │                  │
        └─────────────────┼─────────────────-┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
│   Services   │  │     Hooks    │  │     API      │
│  (Business)  │  │  (Reusable)  │  │  (Client)    │
└──────────────┘  └──────────────┘  └──────────────┘
```

### Directory Structure

```
src/
├── app/                       # Next.js App Router pages
│   ├── home/                  # Home page
│   ├── pipelines/             # Pipeline management pages
│   │   ├── [id]/              # Pipeline details page
│   │   ├── create/            # Pipeline creation page
│   │   └── logs/              # Pipeline logs page
│   └── ui-api/                # API routes (Next.js API)
│       ├── pipeline/          # Pipeline CRUD operations
│       ├── kafka/             # Kafka operations
│       ├── clickhouse/        # ClickHouse operations
│       ├── filter/            # Filter validation
│       ├── platform/          # Platform detection
│       └── healthz/           # Health checks
│
├── components/                # Reusable UI components
│   ├── auth/                  # Authentication components
│   ├── common/                # Common UI components
│   ├── home/                  # Home page components
│   ├── providers/             # Context providers
│   ├── shared/                # Shared components
│   └── ui/                    # Base UI components (shadcn)
│
├── modules/                   # Feature modules
│   ├── clickhouse/            # ClickHouse configuration
│   ├── create/                # Pipeline creation wizard
│   ├── deduplication/         # Deduplication configuration
│   ├── filter/                # Filter configuration (NEW)
│   ├── join/                  # Join operation configuration
│   ├── kafka/                 # Kafka connection & topics
│   ├── pipeline-adapters/     # Pipeline version adapters (NEW)
│   ├── pipelines/             # Pipeline management
│   ├── review/                # Configuration review
│   └── transformation/        # Transformation configuration (NEW)
│
├── store/                     # Zustand state management
│   ├── hydration/             # State hydration from API
│   │   ├── filter.ts          # Filter hydration (NEW)
│   │   └── transformation.ts  # Transformation hydration (NEW)
│   ├── state-machine/         # Validation & dependency graph
│   └── *.store.ts             # Store slices
│
├── analytics/                 # Analytics & event tracking (NEW)
│   ├── eventManager.ts        # Core analytics manager
│   ├── eventDictionary.ts     # Event definitions
│   ├── journeyTracker.ts      # User journey tracking
│   └── eventCatalog.ts        # Event catalog
│
├── observability/             # Observability & telemetry (NEW)
│   ├── logger.ts              # Structured logging
│   ├── metrics.ts             # Metrics collection
│   ├── config.ts              # Observability config
│   └── resource.ts            # Resource attributes
│
├── notifications/             # Notification system (NEW)
│   ├── notify.ts              # Core notification API
│   ├── channels/              # Notification channels (banner, toast, modal, inline)
│   └── messages/              # Predefined message templates
│
├── hooks/                     # Custom React hooks
├── lib/                       # Core libraries & clients
├── api/                       # API client functions
├── services/                  # Business logic services
├── scheme/                    # Zod validation schemas
├── types/                     # TypeScript type definitions
├── utils/                     # Utility functions
└── config/                    # Configuration constants
```

## Core Architectural Patterns

### 1. State Management Pattern

The application uses **Zustand with slice pattern** for state management:

- **Slice-based Architecture**: Each domain (Kafka, ClickHouse, Topics, etc.) has its own store slice
- **Centralized Store**: All slices are combined into a single store via composition
- **Hydration Pattern**: State is hydrated from API responses using dedicated hydration functions
- **Mode-based State**: Supports three modes: `create`, `edit`, and `view`

**Store Slices:**

- `kafka.store.ts` - Kafka connection configuration
- `topics.store.ts` - Kafka topics management
- `clickhouse-connection.store.ts` - ClickHouse connection
- `clickhouse-destination.store.ts` - ClickHouse destination config
- `deduplication.store.ts` - Deduplication configuration
- `join.store.ts` - Join operation configuration
- `filter.store.ts` - Filter configuration (NEW)
- `transformation.store.ts` - Transformation configuration (NEW)
- `steps.store.ts` - Wizard step management
- `core.ts` - Core pipeline state (ID, name, mode, etc.)

### 2. Module Pattern

Features are organized into **self-contained modules**:

- Each module contains its own components, types, and utilities
- Modules communicate through the centralized store
- Clear boundaries between features

**Key Modules:**

- **Kafka Module**: Connection setup, topic selection, event preview, type verification
- **ClickHouse Module**: Connection, destination selection, field mapping
- **Deduplication Module**: Key selection, time window configuration
- **Filter Module** (NEW): Query builder for filtering events with arithmetic expressions
- **Transformation Module** (NEW): Field transformations (passthrough, computed functions)
- **Join Module**: Stream configuration, join key definition
- **Pipelines Module**: List, details, actions (start/stop/edit/pause/resume/terminate), DLQ management
- **Pipeline Adapters Module** (NEW): Version adapters for pipeline config (V1, V2)

### 3. Form Management Pattern

**React Hook Form + Zod** for form handling:

- **Schema-driven Validation**: Zod schemas define form structure and validation rules
- **Type-safe Forms**: TypeScript types inferred from Zod schemas
- **Dynamic Forms**: Form configuration objects drive form rendering
- **Multi-step Forms**: Wizard pattern for complex multi-step configurations

### 4. API Client Pattern

**Layered API Architecture**:

```
UI Components
    ↓
Custom Hooks (useFetchKafkaTopics, useClickhouseConnection)
    ↓
API Client Functions (pipeline-api.ts, health.ts)
    ↓
Next.js API Routes (/ui-api/*)
    ↓
Backend API (glassflow-api)
```

### 5. Client Factory Pattern

**Kafka Client Factory** for handling different authentication methods:

- **Interface-based**: `IKafkaClient` interface abstracts client implementation
- **Factory Method**: `KafkaClientFactory.createClient()` determines client type
- **Gateway Pattern**: Kerberos uses Go-based gateway service
- **KafkaJS**: Standard auth methods use KafkaJS library

### 6. Pipeline Adapter Pattern (NEW)

**Version Adapters** for handling different pipeline configuration versions:

- **Adapter Interface**: `PipelineAdapter` interface for version-specific logic
- **Factory Method**: `getPipelineAdapter(version)` returns appropriate adapter
- **Version Support**: V1 (legacy) and V2 (current) adapters
- **Migration**: Automatic conversion between versions when loading pipelines

## Data Flow

### Pipeline Creation Flow

```
1. User selects operation type (ingest-only, deduplication, join, deduplication-joining)
   ↓
2. Store updates: coreStore.setOperationsSelected()
   ↓
3. Wizard determines journey steps based on operation
   ↓
4. User completes each step:
   - Kafka Connection → kafkaStore
   - Topic Selection → topicsStore
   - Kafka Type Verification → topicsStore (schema validation)
   - Filter Configuration → filterStore (if applicable) (NEW)
   - Transformation Configuration → transformationStore (if applicable) (NEW)
   - Deduplication → deduplicationStore (if applicable)
   - Join Config → joinStore (if applicable)
   - ClickHouse Connection → clickhouseConnectionStore
   - ClickHouse Destination → clickhouseDestinationStore
   ↓
5. Review step: All store slices combined into Pipeline config
   ↓
6. API call: POST /pipeline/create
   ↓
7. Store reset or navigation to pipeline details
```

### Pipeline Edit Flow

```
1. User navigates to pipeline details page
   ↓
2. API call: GET /pipeline/{id}
   ↓
3. Pipeline adapter converts config to current version (if needed)
   ↓
4. Store hydration:
   - coreStore.enterEditMode(config)
   - hydrateKafkaConnection(config)
   - hydrateKafkaTopics(config)
   - hydrateFilterConfiguration(config) (NEW)
   - hydrateTransformationConfiguration(config) (NEW)
   - hydrateClickhouseConnection(config)
   - hydrateClickhouseDestination(config)
   - hydrateJoinConfiguration(config)
   ↓
5. User edits configuration
   ↓
6. Store marked as dirty: coreStore.markAsDirty()
   ↓
7. User saves: POST /pipeline/{id}/edit
   ↓
8. Store updated: coreStore.markAsClean()
```

## Pipeline Operation Types

The application supports four main pipeline operation types:

1. **Ingest-Only** (`ingest-only`)
   - Single topic ingestion
   - No deduplication
   - Direct mapping to ClickHouse

2. **Deduplication** (`deduplication`)
   - Single topic with deduplication
   - Time-window based duplicate detection
   - Key field selection

3. **Joining** (`joining`)
   - Two topics joined together
   - Temporal join with time window
   - Left/right join orientation

4. **Deduplication-Joining** (`deduplication-joining`)
   - Two topics with deduplication on both
   - Combined deduplication and join operations

## Key Architectural Decisions

### 1. Next.js App Router

- **Rationale**: Modern Next.js routing with server components support
- **Benefits**: Better performance, improved SEO, simplified routing

### 2. Zustand over Redux

- **Rationale**: Simpler API, less boilerplate, better TypeScript support
- **Benefits**: Easier to learn, smaller bundle size, flexible patterns

### 3. Slice Pattern for State

- **Rationale**: Better organization, easier testing, clear boundaries
- **Benefits**: Modular state, independent slices, easier maintenance

### 4. Zod for Validation

- **Rationale**: Type-safe schemas, runtime validation, TypeScript inference
- **Benefits**: Single source of truth, type safety, better DX

### 5. Factory Pattern for Kafka Client

- **Rationale**: Different auth methods require different implementations
- **Benefits**: Extensible, testable, clear separation of concerns

### 6. Hydration Pattern

- **Rationale**: Separate hydration logic from store slices
- **Benefits**: Reusable, testable, clear data transformation

### 7. Pipeline Adapter Pattern (NEW)

- **Rationale**: Support multiple pipeline configuration versions
- **Benefits**: Backward compatibility, gradual migration, version management

## Component Architecture

### Component Hierarchy

```
RootLayout
├── ThemeProvider
├── AnalyticsProvider
├── HealthCheckProvider
├── PlatformProvider
├── NotificationProvider
├── AuthProvider
├── Header
└── Page Content
    └── Feature Components
        └── Module Components
            └── UI Components
```

### Component Types

1. **Page Components** (`app/*/page.tsx`)
   - Next.js route components
   - Minimal logic, mostly composition

2. **Module Components** (`modules/*/`)
   - Feature-specific components
   - Business logic included
   - Connected to store

3. **UI Components** (`components/ui/`)
   - Reusable, presentational components
   - No business logic
   - Based on shadcn/ui

4. **Shared Components** (`components/shared/`)
   - Common UI patterns
   - Used across multiple features

## State Management Details

### Store Structure

```typescript
interface Store {
  // Kafka slice
  kafkaStore: KafkaSlice

  // Topics slice
  topicsStore: TopicsSlice

  // ClickHouse slices
  clickhouseConnectionStore: ClickhouseConnectionSlice
  clickhouseDestinationStore: ClickhouseDestinationSlice

  // Operation slices
  deduplicationStore: DeduplicationSlice
  joinStore: JoinSlice
  filterStore: FilterSlice // NEW
  transformationStore: TransformationSlice // NEW

  // Core slice
  coreStore: CoreSlice

  // Steps slice
  stepsStore: StepsSlice

  // Global actions
  resetAllPipelineState: (topicCount: number, force?: boolean) => void
  resetForNewPipeline: (topicCount: number) => void
  resetFormValidationStates: () => void
  clearAllUserData: () => void
}
```

### State Modes

The application supports three operational modes:

1. **Create Mode**: Creating a new pipeline
   - Empty state
   - Wizard flow
   - No base config

2. **Edit Mode**: Editing existing pipeline
   - Hydrated from API
   - Base config stored
   - Dirty state tracking
   - Can discard changes

3. **View Mode**: Read-only view
   - Hydrated from API
   - No editing allowed
   - Display only

### Dependency Graph

The application uses a **dependency graph** to manage state dependencies:

- **Nodes**: Store slices and wizard steps
- **Edges**: Dependencies between nodes
- **Validation**: Ensures dependent data is valid before proceeding
- **Reset Logic**: Cascading resets based on dependencies

## API Architecture

### API Layer Structure

1. **API Client Functions** (`src/api/`)
   - `pipeline-api.ts` - Pipeline CRUD operations
   - `pipeline-health.ts` - Pipeline health checks
   - `pipeline-mock.ts` - Mock API for development
   - `health.ts` - Health check endpoints
   - `platform-api.ts` - Platform detection

2. **Next.js API Routes** (`src/app/ui-api/`)
   - Proxy to backend API
   - Environment-specific configuration
   - Error handling
   - Mock endpoints for development

3. **Services** (`src/services/`)
   - `kafka-service.ts` - Kafka business logic
   - `clickhouse-service.ts` - ClickHouse business logic
   - `pipeline-state-manager.ts` - Pipeline state management
   - `pipeline-status-manager.ts` - Pipeline status tracking
   - `kafka-api-client.ts` - Kafka API client wrapper

### API Endpoints

#### Pipeline Operations

- `GET /ui-api/pipeline` - List all pipelines
- `POST /ui-api/pipeline` - Create new pipeline
- `GET /ui-api/pipeline/[id]` - Get pipeline details
- `POST /ui-api/pipeline/[id]/edit` - Edit pipeline
- `POST /ui-api/pipeline/[id]/pause` - Pause pipeline
- `POST /ui-api/pipeline/[id]/resume` - Resume pipeline
- `POST /ui-api/pipeline/[id]/stop` - Stop pipeline
- `POST /ui-api/pipeline/[id]/terminate` - Terminate pipeline
- `GET /ui-api/pipeline/[id]/health` - Get pipeline health
- `GET /ui-api/pipeline/[id]/metadata` - Get pipeline metadata

#### DLQ Operations

- `GET /ui-api/pipeline/[id]/dlq/state` - Get DLQ state
- `POST /ui-api/pipeline/[id]/dlq/consume` - Consume from DLQ
- `POST /ui-api/pipeline/[id]/dlq/purge` - Purge DLQ

#### Kafka Operations

- `GET /ui-api/kafka` - Test Kafka connection
- `GET /ui-api/kafka/topics` - List Kafka topics
- `GET /ui-api/kafka/topic-details` - Get topic details
- `GET /ui-api/kafka/events` - Get sample events from topic

#### ClickHouse Operations

- `POST /ui-api/clickhouse/test-connection` - Test ClickHouse connection
- `GET /ui-api/clickhouse/databases` - List databases
- `GET /ui-api/clickhouse/tables` - List tables
- `GET /ui-api/clickhouse/schema` - Get table schema
- `GET /ui-api/pipeline/[id]/clickhouse/metrics-from-config` - Get metrics from config

#### Filter Operations

- `POST /ui-api/filter/validate` - Validate filter expression

#### Platform & Health

- `GET /ui-api/platform` - Get platform information
- `GET /ui-api/healthz` - Health check

### Error Handling

- **Structured Errors**: Consistent error format across API
- **Error Boundaries**: React error boundaries for UI errors
- **Notification System**: User-friendly error messages via notification channels
- **Retry Logic**: Automatic retries for transient failures
- **API Error Handler**: Centralized error handling in `notifications/api-error-handler.ts`

## Backend API Architecture

The frontend communicates with the **glassflow-api** backend service (Go-based):

### Backend Components

1. **API Layer** (`glassflow-api/internal/api/`)
   - REST API handlers
   - Request/response processing
   - Middleware (auth, logging, error handling)

2. **Core Services** (`glassflow-api/internal/service/`)
   - Pipeline management
   - Configuration processing
   - State management

3. **Components** (`glassflow-api/internal/component/`)
   - Ingestor (Kafka consumer)
   - Join (temporal joins)
   - Sink (ClickHouse writer)
   - Deduplication service

4. **Storage** (`glassflow-api/internal/storage/`)
   - Pipeline configuration storage
   - State persistence

5. **Orchestration** (`glassflow-api/internal/orchestrator/`)
   - Docker-based execution
   - Kubernetes-based execution

6. **DLQ Management** (`glassflow-api/internal/dlq/`)
   - Dead Letter Queue handling
   - Failed message management

7. **Filter Engine** (`glassflow-api/internal/filter/`)
   - Expression validation
   - Filter execution

8. **Transformer** (`glassflow-api/internal/transformer/`)
   - Data transformation logic
   - Expression evaluation

## Analytics & Observability

### Analytics System (NEW)

**Purpose**: Track user interactions and journey through the application

**Components**:

- `eventManager.ts` - Core analytics manager with event tracking
- `eventDictionary.ts` - Centralized event definitions
- `journeyTracker.ts` - User journey tracking helpers
- `eventCatalog.ts` - Event catalog for documentation

**Features**:

- User journey tracking
- Operation tracking (create, edit, view)
- Step-by-step wizard tracking
- Event-based analytics
- Configurable analytics (can be disabled)

### Observability System (NEW)

**Purpose**: Structured logging and metrics collection compatible with OpenTelemetry

**Components**:

- `logger.ts` - Structured logging with OpenTelemetry compatibility
- `metrics.ts` - Metrics collection and recording
- `config.ts` - Observability configuration
- `resource.ts` - Resource attribute building
- `semconv.ts` - Semantic conventions

**Features**:

- Structured logging
- Metrics collection
- OpenTelemetry compatibility
- Configurable OTLP endpoint
- Resource attribute tracking

## Notification System (NEW)

**Purpose**: Centralized user notification system with multiple channels

**Components**:

- `notify.ts` - Core notification API
- `channels/` - Notification channels:
  - `banner.tsx` - Banner notifications
  - `toast.tsx` - Toast notifications
  - `modal.tsx` - Modal notifications
  - `inline.tsx` - Inline alerts
- `messages/` - Predefined message templates:
  - `pipeline.ts` - Pipeline-related messages
  - `kafka.ts` - Kafka-related messages
  - `clickhouse.ts` - ClickHouse-related messages
  - `validation.ts` - Validation messages
  - `dlq.ts` - DLQ-related messages
  - And more...

**Features**:

- Multiple notification channels
- Predefined message templates
- Type-safe notification API
- Context-aware messages
- Error handling integration

## Security Architecture

### Authentication

- **Auth0 Integration**: Optional authentication via Auth0
- **Environment-based**: Can be disabled via environment variable
- **Middleware**: Route protection via Next.js middleware

### Data Security

- **No Client-side Secrets**: Sensitive data never exposed to client
- **API Proxy**: All backend calls go through Next.js API routes
- **HTTPS Only**: Production requires HTTPS
- **Certificate Validation**: Configurable certificate verification

## Performance Considerations

### Optimization Strategies

1. **Code Splitting**: Next.js automatic code splitting
2. **Lazy Loading**: Dynamic imports for heavy components
3. **Memoization**: React.memo, useMemo, useCallback
4. **State Optimization**: Selective store subscriptions
5. **Image Optimization**: Next.js Image component

### Caching Strategy

- **Event Caching**: Kafka events cached to avoid repeated fetches
- **Schema Caching**: ClickHouse schemas cached
- **Topic Caching**: Available topics cached
- **Browser Cache**: Static assets cached

## Testing Strategy

**Note**: Currently, the project has **no test files**. This is a significant gap that should be addressed.

### Recommended Testing Approach

1. **Unit Tests**: Store slices, utilities, validators
2. **Integration Tests**: API clients, services
3. **Component Tests**: React components with React Testing Library
4. **E2E Tests**: Critical user flows with Playwright/Cypress

## Deployment Architecture

### Build Process

1. **Development**: `pnpm dev` - Next.js dev server
2. **Build**: `pnpm build` - Production build
3. **Start**: `pnpm start` - Production server

### Docker Deployment

- **Multi-stage Build**: Optimized Docker image
- **Alpine-based**: Minimal image size
- **Environment Variables**: Runtime configuration
- **Health Checks**: Built-in health check endpoints

## System Invariants

### State Invariants

1. **Single Source of Truth**: All pipeline state is stored in Zustand store
2. **Immutable Updates**: Store updates create new state objects
3. **Mode Consistency**: Only one mode (create/edit/view) active at a time
4. **Dirty State Tracking**: Changes are tracked via `isDirty` flag in core store
5. **Validation State**: Each store slice maintains its own validation state

### Data Flow Invariants

1. **Unidirectional Flow**: Data flows from API → Store → Components
2. **Hydration Completeness**: All store slices must be hydrated when entering edit mode
3. **Operation Type Consistency**: Operation type determines available wizard steps
4. **Dependency Validation**: Dependent steps cannot be completed before dependencies

### API Invariants

1. **Proxy Pattern**: All backend calls go through Next.js API routes
2. **Error Handling**: All API errors are caught and converted to notifications
3. **Version Compatibility**: Pipeline adapters ensure version compatibility
4. **Idempotency**: Pipeline operations (pause/resume/stop) are idempotent

## Service Responsibilities

### Frontend Services

1. **Kafka Service** (`kafka-service.ts`)
   - Kafka connection management
   - Topic listing and details
   - Event fetching and preview
   - Connection testing

2. **ClickHouse Service** (`clickhouse-service.ts`)
   - ClickHouse connection management
   - Database and table listing
   - Schema fetching
   - Connection testing

3. **Pipeline State Manager** (`pipeline-state-manager.ts`)
   - Pipeline state synchronization
   - Status polling
   - State transitions

4. **Pipeline Status Manager** (`pipeline-status-manager.ts`)
   - Status tracking
   - Health monitoring
   - Status updates

### Backend Services (glassflow-api)

1. **Pipeline Service**
   - Pipeline CRUD operations
   - Configuration validation
   - State management

2. **Ingestor Service**
   - Kafka consumer management
   - Message ingestion
   - Offset management

3. **Deduplication Service**
   - Duplicate detection
   - Time-window management
   - Key-based deduplication

4. **Join Service**
   - Temporal join execution
   - Stream synchronization
   - Join result management

5. **Sink Service**
   - ClickHouse writing
   - Batch management
   - Error handling

6. **DLQ Service**
   - Failed message management
   - DLQ consumption
   - DLQ purging

7. **Filter Service**
   - Expression validation
   - Filter execution
   - Expression parsing

8. **Transformer Service**
   - Data transformation
   - Expression evaluation
   - Function execution

## Dependencies

### External Dependencies

1. **Kafka Cluster**
   - Message source
   - Topic management
   - Consumer groups

2. **ClickHouse Database**
   - Data destination
   - Table management
   - Query execution

3. **Backend API** (glassflow-api)
   - Pipeline management
   - Configuration processing
   - Execution orchestration

4. **Auth0** (optional)
   - Authentication
   - User management

5. **OTLP Endpoint** (optional)
   - Observability data export
   - Metrics and logs

### Internal Dependencies

1. **Store Slices**: Depend on each other via dependency graph
2. **Modules**: Depend on store slices and shared components
3. **API Routes**: Depend on backend API configuration
4. **Services**: Depend on API clients and store

## Future Architecture Considerations

1. **Server Components**: Leverage Next.js server components for better performance
2. **Streaming**: Consider streaming for large data sets
3. **Real-time Updates**: WebSocket support for live pipeline status
4. **Offline Support**: Service worker for offline functionality
5. **Micro-frontends**: Consider if application grows significantly
6. **Enhanced Analytics**: More detailed user behavior tracking
7. **Performance Monitoring**: Real-time performance metrics
8. **A/B Testing**: Framework for feature experimentation
