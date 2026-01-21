# SSE Pipeline Status Streaming

## Overview

This document describes the Server-Sent Events (SSE) implementation for real-time pipeline status updates. SSE replaces client-side polling with server-side polling and streaming, significantly reducing network overhead and improving scalability.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Browser (Client)                                │
│  ┌──────────────────┐    ┌────────────────────┐    ┌───────────────────┐   │
│  │ PipelinesList.tsx│───▶│usePipelineStateAdapter│───▶│ pipelineSSEManager│   │
│  │ PipelineDetails  │    │                    │    │   (EventSource)   │   │
│  └──────────────────┘    └────────────────────┘    └─────────┬─────────┘   │
└──────────────────────────────────────────────────────────────┼─────────────┘
                                                               │
                                                    SSE Connection
                                                               │
┌──────────────────────────────────────────────────────────────┼─────────────┐
│                         Next.js Server                       │             │
│  ┌───────────────────────────────────────────────────────────▼──────────┐  │
│  │              /ui-api/pipeline/status/stream (SSE Route)              │  │
│  │  - Accepts pipelineIds query param                                   │  │
│  │  - Polls backend every 2s                                            │  │
│  │  - Streams status changes to clients                                 │  │
│  │  - Sends heartbeat every 30s                                         │  │
│  └───────────────────────────────────────────────────────────┬──────────┘  │
└──────────────────────────────────────────────────────────────┼─────────────┘
                                                               │
                                                    HTTP Polling
                                                               │
┌──────────────────────────────────────────────────────────────┼─────────────┐
│                         Backend API                          │             │
│  ┌───────────────────────────────────────────────────────────▼──────────┐  │
│  │                    /pipeline/{id}/health                             │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Key Benefits

| Aspect | Polling (Before) | SSE (After) |
|--------|-----------------|-------------|
| Network requests | N clients × M pipelines × every 2s | 1 server × M pipelines × every 2s |
| Client complexity | Each client manages polling | Single EventSource connection |
| Scalability | Linear with users | Constant server load |
| Real-time updates | 2s latency | Near-instant on change |
| Browser resources | Multiple timers per client | Single connection per tab |

## File Structure

```
src/
├── types/
│   └── sse.ts                           # SSE event types and configuration
├── app/ui-api/pipeline/status/stream/
│   └── route.ts                         # SSE streaming endpoint
├── services/
│   └── pipeline-sse-manager.ts          # Client-side EventSource manager
└── hooks/
    ├── usePipelineStateSSE.ts           # SSE-based React hooks
    ├── usePipelineStateAdapter.ts       # Adapter for SSE/polling switching
    └── usePipelineState.ts              # Original polling hooks (preserved)
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_USE_SSE_STATUS` | `false` | Enable SSE for pipeline status updates |

The environment variable is configured through the standard variable propagation system:

1. **Local development**: Set in `.env.local` or `.env`, processed by `generate-env.mjs`
2. **Docker runtime**: Set via container environment, processed by `startup.sh`
3. **Build-time**: Exposed via `next.config.ts` for SSR

The variable is accessed through the centralized `isSSEStatusEnabled()` function from `src/config/feature-flags.ts`.

### SSE Manager Configuration

The SSE manager can be configured via `SSEManagerConfig`:

```typescript
interface SSEManagerConfig {
  endpoint?: string              // Default: '/ui-api/pipeline/status/stream'
  maxReconnectAttempts?: number  // Default: 5
  reconnectDelay?: number        // Default: 1000ms
  maxReconnectDelay?: number     // Default: 30000ms
  heartbeatTimeout?: number      // Default: 45000ms
  enablePollingFallback?: boolean // Default: true
}
```

## Event Types

### Server to Client Events

| Event Type | Description |
|------------|-------------|
| `batch_update` | Initial status for all subscribed pipelines |
| `status_update` | Single pipeline status change |
| `heartbeat` | Keep-alive signal (every 30s) |
| `error` | Error notification |

### Event Payloads

```typescript
// Status update event
interface SSEStatusUpdateEvent {
  type: 'status_update'
  timestamp: number
  pipelineId: string
  status: PipelineStatus
  previousStatus?: PipelineStatus
}

// Batch update event (initial)
interface SSEBatchUpdateEvent {
  type: 'batch_update'
  timestamp: number
  updates: Array<{
    pipelineId: string
    status: PipelineStatus
  }>
}

// Heartbeat event
interface SSEHeartbeatEvent {
  type: 'heartbeat'
  timestamp: number
}
```

## Usage

### Basic Usage (Automatic)

The adapter hook automatically routes to SSE or polling based on the feature flag:

```typescript
// In your component - no changes needed!
import { 
  useMultiplePipelineState, 
  usePipelineMonitoring 
} from '@/src/hooks/usePipelineStateAdapter'

function PipelinesList({ pipelines }) {
  const pipelineIds = pipelines.map(p => p.pipeline_id)
  
  // Automatically uses SSE if enabled, falls back to polling
  const statuses = useMultiplePipelineState(pipelineIds)
  usePipelineMonitoring(pipelineIds)
  
  // ...
}
```

### Direct SSE Usage

For components that need SSE-specific features:

```typescript
import { 
  usePipelineStateSSE,
  useSSEConnectionState,
  useSSEFallbackState 
} from '@/src/hooks/usePipelineStateSSE'

function PipelineStatus({ pipelineId }) {
  const status = usePipelineStateSSE(pipelineId)
  const connectionState = useSSEConnectionState()
  const { isFallbackActive, resetFallback } = useSSEFallbackState()
  
  return (
    <div>
      <span>Status: {status}</span>
      <span>Connection: {connectionState}</span>
      {isFallbackActive && (
        <button onClick={resetFallback}>Retry SSE</button>
      )}
    </div>
  )
}
```

## Connection Lifecycle

### Connection States

```
disconnected → connecting → connected ⟷ reconnecting → error
                              ↑                          │
                              └──────────────────────────┘
                                    (if retries left)
```

| State | Description |
|-------|-------------|
| `disconnected` | No active connection |
| `connecting` | Establishing connection |
| `connected` | Active SSE stream |
| `reconnecting` | Attempting to reconnect after error |
| `error` | Max reconnection attempts reached |

### Reconnection Strategy

1. Connection error occurs
2. Wait `reconnectDelay * 2^(attempt-1)` ms (exponential backoff)
3. Retry connection
4. If `maxReconnectAttempts` reached, trigger fallback to polling

### Browser Visibility Handling

- **Tab hidden**: SSE connection is closed to save resources
- **Tab visible**: SSE connection is re-established automatically

## Fallback Mechanism

If SSE fails repeatedly, the system automatically falls back to the original polling mechanism:

1. SSE connection fails
2. Retry with exponential backoff (up to 5 attempts)
3. If all retries fail, `sse-fallback-triggered` event is dispatched
4. Adapter hook switches to polling-based hooks
5. User can manually reset fallback via `resetFallback()`

## Server-Side Implementation

### SSE Route (`/ui-api/pipeline/status/stream`)

```typescript
// Accepts: GET /ui-api/pipeline/status/stream?pipelineIds=id1,id2,id3
// Returns: text/event-stream

// Response headers:
{
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no'  // Disable nginx buffering
}
```

### Server Polling Logic

- Polls backend `/pipeline/{id}/health` every 2 seconds
- Maintains status cache to detect changes
- Only emits events when status actually changes
- Sends batch update on initial connection

## Testing

### Enable SSE Locally

```bash
# In .env.local
NEXT_PUBLIC_USE_SSE_STATUS=true
```

### Verify SSE Connection

1. Open browser DevTools → Network tab
2. Filter by "EventStream" or look for `/status/stream`
3. Observe events in the EventStream preview

### Debug Logging

The SSE manager logs connection events to the console:

```
[SSE Manager] Connecting to /ui-api/pipeline/status/stream?pipelineIds=...
[SSE Manager] Connection established
[SSE Manager] Batch update: 5 pipelines
[SSE Manager] Status update: pipeline-123 active -> paused
```

## Migration Guide

### From Polling to SSE

1. Set `NEXT_PUBLIC_USE_SSE_STATUS=true` in environment
2. Deploy and monitor for errors
3. Check browser console for SSE connection logs
4. Monitor server logs for polling activity

### Rollback to Polling

1. Set `NEXT_PUBLIC_USE_SSE_STATUS=false` (or remove)
2. Redeploy - polling is immediately restored

No code changes required for either direction.

## Troubleshooting

### SSE Connection Keeps Reconnecting

**Possible causes:**
- Proxy/load balancer timeout (increase timeout or disable buffering)
- Network instability
- Server restart

**Solutions:**
- Check `X-Accel-Buffering: no` header is set
- Increase proxy timeout settings
- Check server logs for errors

### Status Updates Not Appearing

**Possible causes:**
- SSE not enabled
- Fallback to polling triggered
- Backend health endpoint issues

**Debug steps:**
1. Check `NEXT_PUBLIC_USE_SSE_STATUS` is `true`
2. Check browser console for SSE logs
3. Verify `/ui-api/pipeline/status/stream` returns `text/event-stream`
4. Check backend `/pipeline/{id}/health` is responding

### High Server CPU

**Possible cause:** Too many pipelines being polled

**Solution:** Consider implementing server-side batching or reducing poll frequency for inactive pipelines

## Future Improvements

1. **Server-side connection pooling** - Share backend connections across SSE clients
2. **Smart polling intervals** - Reduce frequency for stable pipelines
3. **Delta updates** - Send only changed fields
4. **Message compression** - Reduce bandwidth for large pipeline lists
5. **Priority subscriptions** - Poll visible pipelines more frequently
