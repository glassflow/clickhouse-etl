# Mock API Setup for Frontend Development

This guide explains how to use the mock API system to develop the frontend without relying on the backend services.

## Quick Start

1. **Enable Mock Mode**

   ```bash
   # Copy the example config
   cp mock-config.example .env.local

   # Edit .env.local and set
   NEXT_PUBLIC_USE_MOCK_API=true
   ```

2. **Start Development Server**

   ```bash
   pnpm run dev
   ```

3. **Your app will now use mock data instead of real API calls**

## How It Works

### Architecture

- **Mock API Routes**: `/api/mock/*` handles all mock requests using Next.js App Router
- **Utility Functions**: `src/utils/mock-api.ts` provides switching logic
- **Mock Data Generators**: Create realistic test data
- **Environment-based Switching**: Toggle between mock and real APIs

### File Structure

```
src/app/api/mock/
├── pipeline/
│   ├── route.ts                    # GET /pipeline, POST /pipeline
│   └── [id]/
│       ├── route.ts                # GET /pipeline/{id}, PATCH /pipeline/{id}, DELETE /pipeline/{id}
│       └── dlq/
│           ├── route.ts            # GET /pipeline/{id}/dlq
│           └── stats/
│               └── route.ts        # GET /pipeline/{id}/dlq/stats
├── schemas/
│   ├── route.ts                    # GET /schemas, POST /schemas
│   └── [id]/
│       └── route.ts                # GET /schemas/{id}, PATCH /schemas/{id}, DELETE /schemas/{id}
└── connections/
    ├── route.ts                    # GET /connections, POST /connections
    └── [id]/
        └── route.ts                # GET /connections/{id}, PATCH /connections/{id}, DELETE /connections/{id}
```

### API Endpoints Supported

| Endpoint                            | Method | Mock Response                            |
| ----------------------------------- | ------ | ---------------------------------------- |
| `/api/mock/pipeline`                | GET    | List of pipelines (ListPipelineConfig[]) |
| `/api/mock/pipeline`                | POST   | Create new pipeline                      |
| `/api/mock/pipeline/{id}`           | GET    | Get detailed pipeline                    |
| `/api/mock/pipeline/{id}`           | PATCH  | Update pipeline                          |
| `/api/mock/pipeline/{id}`           | DELETE | Delete pipeline                          |
| `/api/mock/pipeline/{id}/dlq`       | GET    | Get DLQ events                           |
| `/api/mock/pipeline/{id}/dlq/state` | GET    | Get DLQ state (matches backend)          |
| `/api/mock/schemas`                 | GET    | List all schemas                         |
| `/api/mock/schemas`                 | POST   | Create new schema                        |
| `/api/mock/schemas/{id}`            | GET    | Get specific schema                      |
| `/api/mock/schemas/{id}`            | PATCH  | Update schema                            |
| `/api/mock/schemas/{id}`            | DELETE | Delete schema                            |
| `/api/mock/connections`             | GET    | List all connections                     |
| `/api/mock/connections`             | POST   | Create new connection                    |
| `/api/mock/connections/{id}`        | GET    | Get specific connection                  |
| `/api/mock/connections/{id}`        | PATCH  | Update connection                        |
| `/api/mock/connections/{id}`        | DELETE | Delete connection                        |

## Configuration

### Environment Variables

```bash
# Enable/disable mock mode
NEXT_PUBLIC_USE_MOCK_API=true

# Real API URL (used when mock is disabled)
NEXT_PUBLIC_API_URL=http://app:8080

# Mock data configuration
MOCK_KAFKA_TOPICS_COUNT=5
MOCK_CLICKHOUSE_DATABASES_COUNT=3
MOCK_PIPELINE_DELAY_MS=200
```

### Customizing Mock Data

Edit the individual route files to customize mock responses:

```typescript
// In src/app/api/mock/pipelines/route.ts
const mockPipelines: Pipeline[] = [
  {
    id: 'pipeline-001',
    name: 'Custom Pipeline',
    status: 'running',
    // ... your custom data
  },
]
```

## Usage Examples

### Using the New API Client

```typescript
import { getPipelines, createPipeline, getDLQStats, getSchemas } from '@/src/api/pipeline-api'

// Fetch all pipelines
const pipelines = await getPipelines()

// Create a new pipeline
const newPipeline = await createPipeline({
  name: 'My New Pipeline',
  config: {
    kafka: {
      topics: ['my-topic'],
      consumer_group: 'my-consumer',
    },
    clickhouse: {
      database: 'my_database',
      table: 'my_table',
    },
    operations: ['deduplication'],
  },
})

// Get DLQ stats for a pipeline
const dlqStats = await getDLQStats('pipeline-001')

// Get all schemas
const schemas = await getSchemas()
```

### In Your Components

```typescript
import { getApiUrl, isMockMode } from '@/src/utils/mock-api'

// Your component will automatically use mock or real API
const fetchPipelines = async () => {
  const url = getApiUrl('pipelines')
  const response = await fetch(url)
  return response.json()
}
```

### Direct Mock Functions

```typescript
import { generateMockPipeline, generateMockSchema, generateMockDLQStats } from '@/src/utils/mock-api'

// Use mock-specific functions for enhanced control
const pipeline = generateMockPipeline('custom-id')
const schema = generateMockSchema('schema-001')
const dlqStats = generateMockDLQStats('pipeline-001')
```

## Data Structures

### Pipeline Object

```typescript
interface Pipeline {
  id: string
  name: string
  status: 'running' | 'paused' | 'error' | 'stopped'
  created_at: string
  updated_at: string
  config: {
    kafka: {
      topics: string[]
      consumer_group: string
    }
    clickhouse: {
      database: string
      table: string
    }
    operations: string[]
  }
  stats: {
    events_processed: number
    events_failed: number
    throughput_per_second: number
    last_event_processed: string | null
  }
  error?: string
}
```

### Schema Object

```typescript
interface Schema {
  id: string
  name: string
  version: string
  created_at: string
  updated_at: string
  schema: Record<string, any>
  mappings: Record<string, any>
}
```

### DLQ Stats Object

```typescript
interface DLQStats {
  total_failed_events: number
  failed_events_today: number
  last_failure: string
  failure_rate: number
  top_error_types: Array<{ error_type: string; count: number }>
}
```

## Benefits

1. **No Backend Dependency**: Develop frontend independently
2. **Fast Development**: No network delays or backend setup
3. **Consistent Data**: Predictable test data
4. **Easy Switching**: Toggle between mock and real with env var
5. **Type Safety**: Reuse existing TypeScript interfaces
6. **Realistic Responses**: Mock data matches real API structure
7. **Complete API Coverage**: All endpoints from your specification
8. **Proper Next.js Structure**: Uses App Router conventions

## Advanced Features

### Dynamic Mock Data

The mock system can generate different responses based on request parameters:

```typescript
// In your mock API route
export async function POST(request: Request) {
  const body = await request.json()
  const { name, config } = body

  // Generate different pipeline based on config
  const pipeline = config?.operations?.includes('joining')
    ? generateComplexPipeline(name)
    : generateSimplePipeline(name)

  return NextResponse.json({ success: true, pipeline })
}
```

### Error Simulation

Test error handling by adding error conditions:

```typescript
// Simulate network errors
if (Math.random() < 0.1) {
  // 10% chance of error
  return NextResponse.json(
    {
      success: false,
      error: 'Simulated network error',
    },
    { status: 500 },
  )
}
```

### Performance Testing

Add delays to simulate real network conditions:

```typescript
// Simulate network delay
await new Promise((resolve) => setTimeout(resolve, 200))
```

## Troubleshooting

### Mock Not Working

1. Check `NEXT_PUBLIC_USE_MOCK_API=true` in `.env.local`
2. Restart the development server
3. Check browser console for errors

### API Routes Not Found (404 Errors)

**This was the main issue!** The problem was using a single `route.ts` file instead of proper Next.js App Router structure.

**Solution**: We now use the correct file structure:

- `/api/mock/pipelines/route.ts` for `/api/mock/pipelines`
- `/api/mock/pipelines/[id]/route.ts` for `/api/mock/pipelines/{id}`
- `/api/mock/pipelines/[id]/dlq/route.ts` for `/api/mock/pipelines/{id}/dlq`

### Type Errors

1. Import types from `src/api/pipeline-api.ts`
2. Ensure mock responses match expected interfaces
3. Use TypeScript strict mode for better error detection

## Best Practices

1. **Keep Mock Data Realistic**: Match real API response structure
2. **Use Environment Variables**: Don't hardcode mock settings
3. **Test Both Modes**: Ensure your app works with real and mock APIs
4. **Document Mock Behavior**: Keep this guide updated
5. **Version Control**: Include mock configuration in your repo
6. **Use TypeScript**: Leverage type safety for better development experience
7. **Follow Next.js Conventions**: Use proper App Router file structure

## Migration to Production

When ready to deploy:

1. Set `NEXT_PUBLIC_USE_MOCK_API=false` in production
2. Ensure real API endpoints are available
3. Test with real backend services
4. Remove any mock-specific code if desired

The mock system is designed to be completely transparent - your existing code will work unchanged when switching between mock and real APIs.

## API Testing

You can test the mock API endpoints directly:

```bash
# Test pipelines endpoint
curl http://localhost:8080/api/mock/pipelines

# Test creating a pipeline
curl -X POST http://localhost:8080/api/mock/pipelines \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Pipeline"}'

# Test getting a specific pipeline
curl http://localhost:8080/api/mock/pipelines/pipeline-001

# Test DLQ stats
curl http://localhost:8080/api/mock/pipelines/pipeline-001/dlq/stats

# Run the complete test suite
./test-mock-api.sh
```

## Why the 404 Errors Were Happening

The original issue was that we were trying to use a single `route.ts` file to handle all endpoints with query parameters. This doesn't work with Next.js App Router, which expects:

1. **Static routes**: `/api/mock/pipelines/route.ts` for `/api/mock/pipelines`
2. **Dynamic routes**: `/api/mock/pipelines/[id]/route.ts` for `/api/mock/pipelines/{id}`
3. **Nested routes**: `/api/mock/pipelines/[id]/dlq/route.ts` for `/api/mock/pipelines/{id}/dlq`

The fix involved creating the proper file structure that Next.js App Router expects, which is why the curl commands now work correctly.
