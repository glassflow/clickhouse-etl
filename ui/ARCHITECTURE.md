# ClickHouse ETL UI Architecture Documentation

## Overview

The ClickHouse ETL UI is a Next.js-based web application designed for creating and managing data pipelines that stream data from Kafka to ClickHouse. The application provides a comprehensive interface for configuring data ingestion, transformation, and storage operations with support for advanced features like deduplication and joining.

## Technology Stack

### Core Technologies

- **Framework**: Next.js 15.3.0 (App Router)
- **Language**: TypeScript 5.8.3
- **Styling**: Tailwind CSS 4.1.3 + shadcn/ui components
- **State Management**: Zustand 5.0.5 with slice-based architecture
- **Form Management**: React Hook Form 7.55.0 with Zod validation
- **HTTP Client**: Axios 1.8.4
- **External Services**: KafkaJS, ClickHouse Client

### Development Tools

- **Linting**: ESLint with TypeScript and React plugins
- **Code Formatting**: Prettier
- **Package Manager**: pnpm
- **Build Tool**: Next.js built-in bundler
- **Analytics**: Mixpanel integration

## Project Structure

```
src/
├── analytics/           # Analytics and event tracking
├── api/                # API layer and external service clients
├── app/                # Next.js App Router pages and API routes
│   ├── ui-api/         # Backend API routes (Next.js API routes)
│   └── [pages]/        # Frontend pages
├── components/         # Reusable UI components
│   ├── common/         # Common utility components
│   ├── shared/         # Shared layout components
│   └── ui/             # shadcn/ui base components
├── config/             # Configuration files and form schemas
├── contexts/           # React contexts for global state
├── hooks/              # Custom React hooks
├── lib/                # External service clients (Kafka, ClickHouse)
├── modules/            # Feature-based modules
├── scheme/             # Zod validation schemas
├── services/           # Business logic services
├── store/              # Zustand state management
├── themes/             # Theme configuration
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Architecture Layers

### 1. Presentation Layer (Components & Pages)

#### Component Organization

The application follows a hierarchical component structure:

- **UI Components** (`components/ui/`): Base shadcn/ui components with custom variants
- **Shared Components** (`components/shared/`): Layout and common UI components
- **Common Components** (`components/common/`): Utility and helper components
- **Module Components** (`modules/*/components/`): Feature-specific components

#### Key Component Patterns

- **Container Components**: Manage state and business logic
- **Presentation Components**: Pure UI components with props
- **Form Components**: Integrated with React Hook Form and Zod validation
- **Modal Components**: Radix UI-based modal system

#### Page Structure

Next.js App Router structure:

- **Home Page** (`/home`): Landing and pipeline creation entry point
- **Pipeline Pages** (`/pipelines`): Pipeline listing and management
- **Pipeline Detail** (`/pipelines/[id]`): Individual pipeline configuration and monitoring
- **Pipeline Create** (`/pipelines/create`): Pipeline creation wizard

### 2. State Management Layer

#### Zustand Slice Architecture

The application uses a sophisticated Zustand store with multiple slices:

```typescript
interface Store
  extends KafkaSlice,
    ClickhouseConnectionSlice,
    ClickhouseDestinationSlice,
    StepsSlice,
    TopicsSlice,
    DeduplicationSlice,
    JoinSlice,
    CoreSlice {
  // Global state management methods
  resetAllPipelineState: (operation: string, force?: boolean) => void
  resetForNewPipeline: (operation: string) => void
  resetFormValidationStates: () => void
  clearAllUserData: () => void
}
```

#### Store Slices

- **Core Store**: Pipeline metadata, operations, and global state
- **Kafka Store**: Kafka connection and topic management
- **ClickHouse Connection Store**: ClickHouse connection configuration
- **ClickHouse Destination Store**: Destination table and mapping configuration
- **Topics Store**: Kafka topic selection and configuration
- **Deduplication Store**: Deduplication logic configuration
- **Join Store**: Data joining operations configuration
- **Steps Store**: Pipeline step management and validation

#### State Management Patterns

- **Slice-based Architecture**: Each domain has its own slice
- **Hydration System**: State can be hydrated from saved configurations
- **Mode Management**: Support for create/edit/view modes
- **Dirty State Tracking**: Track unsaved changes across the application
- **Validation State**: Separate validation state from data state

### 3. API Layer

#### Next.js API Routes

The application uses Next.js API routes for backend functionality:

- **Pipeline Management** (`/ui-api/pipeline/`): CRUD operations for pipelines
- **Kafka Integration** (`/ui-api/kafka/`): Kafka connection and topic management
- **ClickHouse Integration** (`/ui-api/clickhouse/`): ClickHouse connection and schema management
- **Health Checks** (`/ui-api/healthz/`): System health monitoring
- **Mock API** (`/ui-api/mock/`): Development and testing endpoints

#### External Service Integration

- **Kafka Service**: Connection testing, topic listing, event fetching
- **ClickHouse Service**: Connection testing, database/table listing, schema inspection
- **Pipeline API**: Backend communication for pipeline operations

### 4. Module Architecture

#### Feature-Based Modules

The application is organized into feature modules:

- **Kafka Module** (`modules/kafka/`): Kafka connection and topic management
- **ClickHouse Module** (`modules/clickhouse/`): ClickHouse connection and destination configuration
- **Deduplication Module** (`modules/deduplication/`): Data deduplication configuration
- **Join Module** (`modules/join/`): Data joining operations
- **Pipeline Module** (`modules/pipelines/`): Pipeline management and monitoring
- **Review Module** (`modules/review/`): Configuration review and validation

#### Module Structure

Each module contains:

- **Main Container**: State management and business logic
- **Components**: Module-specific UI components
- **Hooks**: Module-specific custom hooks
- **Types**: Module-specific TypeScript types
- **Utils**: Module-specific utility functions

### 5. External Service Integration

#### Kafka Integration

- **Connection Management**: Multiple authentication methods (SASL, mTLS, AWS MSK IAM)
- **Topic Management**: Topic listing, selection, and configuration
- **Event Preview**: Real-time event sampling and preview
- **Offset Management**: Consumer group and offset configuration

#### ClickHouse Integration

- **Connection Management**: Direct, proxy, and connection string support
- **Database Management**: Database listing and selection
- **Table Management**: Table listing, schema inspection, and mapping
- **Query Execution**: Test queries and schema validation

#### Service Layer Architecture

```typescript
// Kafka Service
export class KafkaService {
  async testConnection(config: KafkaConfig): Promise<boolean>
  async getTopics(config: KafkaConfig): Promise<string[]>
  async getTopicDetails(config: KafkaConfig): Promise<TopicDetails[]>
  async fetchEvent(params: FetchEventParams): Promise<EventData>
}

// ClickHouse Service
export class ClickhouseService {
  async testConnection(params: ConnectionParams): Promise<ConnectionResult>
  async getDatabases(config: ClickHouseConfig): Promise<string[]>
  async getTables(config: ClickHouseConfig): Promise<TableInfo[]>
  async getTableSchema(config: ClickHouseConfig): Promise<SchemaInfo>
}
```

### 6. Form Management & Validation

#### React Hook Form Integration

- **Form State Management**: Integrated with Zustand store
- **Validation**: Zod schema-based validation
- **Error Handling**: Comprehensive error state management
- **Field Dependencies**: Dynamic form behavior based on selections

#### Validation Schemas

- **Kafka Connection**: Multiple authentication method schemas
- **ClickHouse Connection**: Connection type-specific schemas
- **Pipeline Configuration**: End-to-end pipeline validation
- **Field Mapping**: Dynamic field validation based on data types

### 7. Analytics & Monitoring

#### Event Tracking

- **Mixpanel Integration**: User behavior and feature usage tracking
- **Journey Analytics**: Step-by-step user journey tracking
- **Error Tracking**: Connection and validation error monitoring
- **Performance Metrics**: Pipeline creation and deployment metrics

#### Analytics Architecture

```typescript
// Journey Analytics
export const useJourneyAnalytics = () => ({
  kafka: {
    connectionAttempted: (config: KafkaConfig) => void
    connectionSuccess: (config: KafkaConfig) => void
    connectionFailed: (error: string) => void
  },
  clickhouse: {
    connectionAttempted: (config: ClickHouseConfig) => void
    connectionSuccess: (config: ClickHouseConfig) => void
    connectionFailed: (error: string) => void
  }
})
```

### 8. Theme & Styling

#### Design System

- **shadcn/ui**: Base component library with custom variants
- **Tailwind CSS**: Utility-first styling approach
- **Custom Theme**: GlassFlow-specific design tokens
- **Dark/Light Mode**: Theme switching support

#### Styling Architecture

- **Component Variants**: CVA-based variant system
- **Responsive Design**: Mobile-first responsive approach
- **Accessibility**: ARIA-compliant components
- **Custom Properties**: CSS custom properties for theming

## Key Architectural Patterns

### 1. Feature-Driven Development

- Each major feature (Kafka, ClickHouse, Pipelines) has its own module
- Clear separation between different business domains
- Modular architecture allows for independent development and testing

### 2. Slice-Based State Management

- Zustand slices provide domain-specific state management
- Global state coordination through the main store
- Hydration system for loading saved configurations

### 3. Container/Presentation Pattern

- Container components manage state and business logic
- Presentation components focus on UI rendering
- Clear separation of concerns between logic and presentation

### 4. Service Layer Pattern

- External service interactions abstracted into service classes
- Consistent error handling and response formatting
- Testable business logic separation

### 5. Hook-Based Logic Reuse

- Custom hooks encapsulate complex logic
- Reusable state management patterns
- Clean separation between UI and business logic

## Data Flow

### 1. Pipeline Creation Flow

1. User selects operation type (ingest, deduplication, join)
2. Kafka connection configuration and testing
3. Topic selection and configuration
4. ClickHouse connection configuration and testing
5. Destination table selection and field mapping
6. Configuration review and validation
7. Pipeline deployment and monitoring

### 2. State Management Flow

1. User interaction triggers store action
2. Store action updates slice state
3. Components automatically re-render based on state changes
4. Form validation updates validation state
5. External service calls update connection state

### 3. External Service Integration Flow

1. User configures connection parameters
2. Service layer validates and formats request
3. API route processes request and calls external service
4. Response is processed and stored in appropriate slice
5. UI updates to reflect connection status and available options

## Performance Optimizations

### 1. Next.js Optimizations

- **App Router**: Modern Next.js routing with server components
- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component for optimized loading
- **Static Generation**: Pre-rendered pages where possible

### 2. State Management Optimizations

- **Selective Subscriptions**: Components only subscribe to relevant state slices
- **Memoization**: React.memo and useMemo for expensive computations
- **Lazy Loading**: Dynamic imports for heavy components

### 3. External Service Optimizations

- **Connection Pooling**: Reuse connections where possible
- **Caching**: Cache database and table schemas
- **Error Handling**: Graceful degradation on service failures

## Security Considerations

### 1. Data Protection

- **Input Validation**: Comprehensive Zod schema validation
- **XSS Prevention**: React's built-in XSS protection
- **CSRF Protection**: Same-origin policy enforcement
- **Secure Headers**: Security headers in API responses

### 2. External Service Security

- **Credential Management**: Secure handling of connection credentials
- **TLS/SSL**: Encrypted connections to external services
- **Authentication**: Multiple secure authentication methods

### 3. Environment Security

- **Environment Variables**: Sensitive configuration in environment variables
- **API Key Management**: Secure API key handling
- **Docker Security**: Containerized deployment with security best practices

## Testing Strategy

### 1. Unit Testing

- **Component Testing**: Individual component testing with React Testing Library
- **Hook Testing**: Custom hook testing with testing utilities
- **Service Testing**: Service layer testing with mocked external services

### 2. Integration Testing

- **API Integration**: API route testing with test databases
- **External Service Integration**: Mock external service responses
- **End-to-End Testing**: Full user journey testing

### 3. Development Testing

- **Mock API**: Development mock API for testing without external services
- **Hot Reloading**: Fast development feedback loop
- **Type Safety**: Compile-time error detection

## Deployment & Build Process

### 1. Build Configuration

- **Next.js Build**: Optimized production builds
- **Environment Variables**: Build-time configuration
- **Asset Optimization**: Image and asset optimization
- **Bundle Analysis**: Bundle size monitoring

### 2. Docker Deployment

- **Multi-stage Builds**: Optimized Docker images
- **Environment Configuration**: Docker-based environment management
- **Health Checks**: Container health monitoring

## Areas for Improvement

### 1. State Management

- **Store Consolidation**: Some slices could be merged for better organization
- **State Normalization**: Consider normalizing nested state structures
- **Error State Management**: More robust error state handling across slices

### 2. Component Architecture

- **Component Library**: Extract common components into a shared library
- **Storybook Integration**: Component documentation and testing
- **Accessibility**: Enhanced accessibility features and testing

### 3. Performance

- **Bundle Analysis**: Regular bundle size analysis and optimization
- **Lazy Loading**: More aggressive code splitting for heavy modules
- **Caching Strategy**: Implement service worker for offline functionality

### 4. Developer Experience

- **Testing Coverage**: Increase test coverage across the application
- **Documentation**: More comprehensive component and API documentation
- **Development Tools**: Enhanced debugging and development tools

### 5. Scalability

- \*\*No observed improvement areas

### 6. External Service Integration

- **Connection Pooling**: Implement connection pooling for better performance
- **Retry Logic**: Add exponential backoff for failed connections
- **Monitoring**: Enhanced monitoring and alerting for external services
