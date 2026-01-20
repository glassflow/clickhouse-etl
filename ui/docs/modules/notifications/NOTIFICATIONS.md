# Notifications Module Documentation

## Overview

The Notifications module provides a comprehensive system for displaying, managing, and configuring pipeline notifications within the GlassFlow UI. It includes a slide-out panel for quick access, a full-page management view, and a settings interface for configuring notification channels and severity routing.

## Architecture

### Component Hierarchy

```
Notifications System
├── NotificationBadge (Header Component)
│   └── useNotifications (Polling Hook)
│
├── NotificationsPanel (Slide-out Panel)
│   ├── Filter Tabs (all/unread/read)
│   ├── Bulk Actions Bar
│   └── NotificationItem (Individual Items)
│       ├── Severity Icon
│       ├── Title & Message
│       ├── Pipeline Link
│       └── Action Buttons (Mark Read, Delete)
│
├── NotificationsPage (/notifications)
│   └── NotificationManagement (Container)
│       ├── Stats Bar (Total/Unread Counts)
│       ├── NotificationFilters (Advanced Filters)
│       │   ├── Pipeline ID Search
│       │   ├── Severity Filter
│       │   ├── Read Status Filter
│       │   └── Date Range Pickers
│       └── NotificationTable (Paginated Table)
│           ├── Bulk Selection
│           ├── Expandable Rows
│           └── Pagination Controls
│
└── NotificationSettingsPage (/notifications/settings)
    └── NotificationSettingsPanel (Container)
        ├── Mute Toggle
        ├── ChannelSettings
        │   ├── ChannelCard (Slack/Email)
        │   └── ChannelConfigDialog
        │       ├── SlackConfigForm
        │       └── EmailConfigForm
        └── SeverityMappings
            └── SeverityCard (per severity level)
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UI Components                                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────────┐     │
│  │NotificationBadge│  │NotificationsPanel│  │NotificationManagement│     │
│  └───────┬──────┘  └────────┬─────────┘  └──────────┬─────────────┘     │
│          │                   │                       │                    │
│          └───────────────────┴───────────────────────┘                    │
│                              │                                            │
│                              ▼                                            │
│                    ┌─────────────────────┐                               │
│                    │  notificationsStore  │ (Zustand)                    │
│                    │  - notifications[]   │                               │
│                    │  - filters           │                               │
│                    │  - selectedIds       │                               │
│                    │  - pagination        │                               │
│                    └──────────┬──────────┘                               │
│                               │                                           │
└───────────────────────────────┼───────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  notificationsApi     │ (API Client)
                    │  - fetchNotifications │
                    │  - markAsRead         │
                    │  - deleteNotification │
                    │  - channels CRUD      │
                    │  - severity mappings  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  /ui-api/notifications│ (Next.js API Routes)
                    │  - Proxy to backend   │
                    │  - Mock mode support  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  GlassFlow Notifier   │ (Backend Service)
                    │  - PostgreSQL storage │
                    │  - Slack/Email delivery│
                    └──────────────────────┘
```

## Core Components

### 1. NotificationBadge

**Location:** `src/components/shared/NotificationBadge.tsx`

**Purpose:** Header component that displays a bell icon with unread count badge and triggers the notifications panel.

**Key Features:**
- Displays unread notification count (99+ for counts over 99)
- Initializes notification polling via `useNotifications` hook
- Toggles the slide-out panel on click
- Hidden when notifications feature is disabled

**Props:** None (uses store directly)

**Usage:**
```tsx
// In header/layout component
<NotificationBadge />
```

### 2. NotificationsPanel

**Location:** `src/components/notifications/NotificationsPanel.tsx`

**Purpose:** Slide-out panel that provides quick access to notifications without leaving the current page.

**Key Features:**
- Filter tabs (All, Unread, Read)
- Bulk selection and actions
- Individual notification actions
- Links to full page and settings

**Key Functions:**

#### `handleSelectAll()`
Toggles selection of all filtered notifications.

#### `handleMarkSelectedAsRead()`
Marks all selected notifications as read via bulk API.

#### `handleDeleteSelected()`
Deletes all selected notifications via bulk API.

**State Management:**
- Uses `notificationsStore` for all notification data
- Local `filter` state for filtering view
- Derives `filteredNotifications` from store data

### 3. NotificationItem

**Location:** `src/components/notifications/NotificationItem.tsx`

**Purpose:** Renders a single notification card in the panel with actions.

**Key Features:**
- Severity-based styling (icon, colors)
- Relative timestamp formatting
- Pipeline ID with copy and link actions
- Mark as read and delete actions
- Selection checkbox

**Props:**
```typescript
interface NotificationItemProps {
  notification: Notification
  isSelected: boolean
  onSelect: () => void
  onMarkAsRead: () => void
  onDelete: () => void
  onClosePanel?: () => void
}
```

**Severity Configuration:**
```typescript
const SEVERITY_CONFIG: Record<NotificationSeverity, {
  icon: typeof AlertCircle
  colorVar: string
  borderColorVar: string
  bgColorVar: string
}>
```

### 4. NotificationManagement

**Location:** `src/modules/notifications/NotificationManagement.tsx`

**Purpose:** Main container for the full notifications page, combining stats, filters, and table.

**Key Features:**
- Stats bar with total and unread counts
- Refresh button
- Integrates NotificationFilters and NotificationTable

**State Management:**
- Reads from `notificationsStore`
- Triggers `fetchNotifications` on refresh

### 5. NotificationFilters

**Location:** `src/modules/notifications/components/NotificationFilters.tsx`

**Purpose:** Advanced filtering panel for the notifications page.

**Filter Options:**
| Filter | Type | Description |
|--------|------|-------------|
| `pipeline_id` | Text input | Search by pipeline ID |
| `severity` | Select | Filter by severity level |
| `read_status` | Select | Filter by read/unread status |
| `start_date` | Date picker | Start of date range |
| `end_date` | Date picker | End of date range |

**Key Functions:**

#### `handleApplyFilters()`
Triggers `fetchNotifications` with current filter values.

#### `handleClearFilters()`
Resets all filters and fetches notifications.

**State Management:**
- Uses `setFilters` from store to update filter values
- Filters are applied on explicit "Apply" action

### 6. NotificationTable

**Location:** `src/modules/notifications/components/NotificationTable.tsx`

**Purpose:** Paginated table display for notifications with bulk actions.

**Key Features:**
- Expandable rows for full message view
- Bulk selection with checkbox column
- Individual row actions
- Pagination with configurable page size
- Empty and error states

**Key Functions:**

#### `NotificationTableRow`
Sub-component for rendering individual table rows with expansion support.

**Props:**
```typescript
{
  notification: Notification
  isSelected: boolean
  isExpanded: boolean
  onToggleSelect: () => void
  onToggleExpand: () => void
  onMarkAsRead: () => void
  onDelete: () => void
}
```

### 7. NotificationSettingsPanel

**Location:** `src/modules/notifications/NotificationSettingsPanel.tsx`

**Purpose:** Main settings panel combining mute toggle, channel settings, and severity mappings.

**Key Features:**
- Mute toggle with localStorage persistence
- Visual indication of muted state
- Dims channel and severity sections when muted

**State Management:**
- `isMuted` state persisted to localStorage (`glassflow_notifications_muted`)
- `isHydrated` flag for SSR compatibility

### 8. ChannelSettings

**Location:** `src/modules/notifications/components/ChannelSettings.tsx`

**Purpose:** Displays and manages notification channel configurations (Slack, Email).

**Key Features:**
- Channel cards showing configuration status
- Enable/disable toggles
- Configure/Edit buttons opening dialog
- Refresh functionality

**Sub-Components:**

#### `ChannelCard`
Individual channel display with toggle and configure actions.

**Props:**
```typescript
interface ChannelCardProps {
  channel: Channel | null
  channelType: ChannelType
  isLoading: boolean
  onToggle: (enabled: boolean) => Promise<void>
  onConfigure: () => void
}
```

### 9. ChannelConfigDialog

**Location:** `src/modules/notifications/components/ChannelConfigDialog.tsx`

**Purpose:** Modal dialog for creating or editing channel configurations.

**Key Features:**
- Renders appropriate form based on channel type
- Handles create and update operations
- Error display
- Loading states

**Props:**
```typescript
interface ChannelConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelType: ChannelType
  existingChannel: Channel | null
  onSuccess: () => void
}
```

### 10. SlackConfigForm

**Location:** `src/modules/notifications/components/SlackConfigForm.tsx`

**Purpose:** Form for configuring Slack webhook settings.

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `webhook_url` | Yes | Slack webhook URL |
| `default_channel` | No | Override default channel |

**Validation:**
- Webhook URL required
- Must start with `https://hooks.slack.com/`

### 11. EmailConfigForm

**Location:** `src/modules/notifications/components/EmailConfigForm.tsx`

**Purpose:** Form for configuring SMTP email settings.

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `smtp_host` | Yes | SMTP server hostname |
| `smtp_port` | Yes | SMTP port (default: 587) |
| `smtp_username` | Yes | SMTP authentication username |
| `smtp_password` | Yes | SMTP authentication password |
| `smtp_use_tls` | No | Enable TLS (default: true) |
| `from_address` | No | Sender email address |
| `from_name` | No | Sender display name |
| `to_addresses` | Yes | Comma-separated recipient emails |

**Validation:**
- Required fields validation
- Port range validation (1-65535)
- Email format validation for recipients

### 12. SeverityMappings

**Location:** `src/modules/notifications/components/SeverityMappings.tsx`

**Purpose:** Configures which channels receive notifications for each severity level.

**Key Features:**
- Grid of severity cards
- Channel toggle buttons per severity
- Bulk save functionality
- Unsaved changes indicator

**Severity Levels:**
- `debug` - Debug/diagnostic information
- `info` - Informational messages
- `warn` - Warning messages
- `error` - Error conditions
- `fatal` - Fatal/critical errors

**Sub-Components:**

#### `SeverityCard`
Individual severity configuration with channel toggles.

#### `ChannelToggleButton`
Large toggle button for enabling/disabling a channel for a severity.

## Hooks

### useNotifications

**Location:** `src/hooks/useNotifications.ts`

**Purpose:** Provides notification data management with automatic polling.

**Options:**
```typescript
interface UseNotificationsOptions {
  enabled?: boolean           // Enable/disable polling (default: true)
  pollingInterval?: number    // Custom interval in ms
  fetchOnMount?: boolean      // Fetch on mount (default: true)
}
```

**Features:**
- Initial fetch on mount
- Configurable polling interval (default: 30 seconds)
- Visibility change handling (refreshes when tab becomes visible)
- Silent refresh (no loading state during polling)

**Usage:**
```tsx
// Basic usage
useNotifications({ enabled: true })

// With custom interval
useNotifications({ enabled: true, pollingInterval: 60000 })

// Access data from store
const { notificationsStore } = useStore()
const { notifications, unreadCount, isLoading } = notificationsStore
```

## State Management

### NotificationsStore

**Location:** `src/store/notifications.store.ts`

**Purpose:** Manages all notification-related state using Zustand.

**State Structure:**
```typescript
interface NotificationsStoreProps {
  // Data
  notifications: Notification[]
  totalCount: number
  unreadCount: number

  // Loading/Error
  isLoading: boolean
  error: string | null

  // Filters & Pagination
  filters: NotificationFilters
  currentPage: number
  pageSize: number

  // Selection
  selectedIds: Set<string>

  // Panel
  isPanelOpen: boolean

  // Polling
  lastFetchedAt: number | null
  pollingInterval: number
}
```

**Actions:**

#### Data Fetching
- `fetchNotifications()` - Fetch with loading state
- `refreshNotifications()` - Silent fetch (no loading state)

#### Single Operations
- `markAsRead(notificationId)` - Mark single notification as read
- `deleteNotification(notificationId)` - Delete single notification

#### Bulk Operations
- `markSelectedAsRead()` - Mark all selected as read
- `deleteSelected()` - Delete all selected

#### Selection Management
- `selectNotification(id)` - Add to selection
- `deselectNotification(id)` - Remove from selection
- `selectAll()` - Select all current notifications
- `deselectAll()` - Clear selection
- `toggleSelection(id)` - Toggle single selection

#### Filter Management
- `setFilters(filters)` - Update filters (resets to page 1)
- `clearFilters()` - Clear all filters
- `setPage(page)` - Set current page
- `setPageSize(size)` - Set page size (resets to page 1)

#### Panel Management
- `openPanel()` - Open slide-out panel
- `closePanel()` - Close panel
- `togglePanel()` - Toggle panel state

#### Other
- `setPollingInterval(interval)` - Update polling interval
- `resetNotificationsStore()` - Reset to initial state

**Initial State:**
```typescript
const initialNotificationsStore: NotificationsStoreProps = {
  notifications: [],
  totalCount: 0,
  unreadCount: 0,
  isLoading: false,
  error: null,
  filters: {},
  currentPage: 1,
  pageSize: 20,
  selectedIds: new Set<string>(),
  isPanelOpen: false,
  lastFetchedAt: null,
  pollingInterval: 30000,
}
```

## API Layer

### NotificationsApiClient

**Location:** `src/services/notifications-api.ts`

**Purpose:** Client-side service for interacting with the notification system via proxy routes.

**Base URL:** `/ui-api/notifications`

#### Notification Methods

| Method | Description |
|--------|-------------|
| `fetchNotifications(filters?)` | List notifications with optional filters |
| `fetchNotification(id)` | Get single notification by ID |
| `markAsRead(id)` | Mark notification as read |
| `markAsReadBulk(ids)` | Mark multiple as read |
| `deleteNotification(id)` | Soft delete notification |
| `deleteNotificationsBulk(ids)` | Soft delete multiple |

#### Channel Methods

| Method | Description |
|--------|-------------|
| `fetchChannels()` | Get all channel configurations |
| `fetchChannel(type)` | Get specific channel |
| `updateChannel(type, config)` | Create/update channel |
| `deleteChannel(type)` | Delete channel configuration |

#### Severity Mapping Methods

| Method | Description |
|--------|-------------|
| `fetchSeverityMappings()` | Get all severity mappings |
| `fetchSeverityMapping(severity)` | Get specific mapping |
| `updateSeverityMapping(severity, channels)` | Update single mapping |
| `updateSeverityMappingsBulk(mappings)` | Bulk update mappings |
| `deleteSeverityMapping(severity)` | Delete mapping |

### Proxy Routes

**Location:** `src/app/ui-api/notifications/`

All routes proxy to the GlassFlow Notifier backend service and support mock mode via `NEXT_PUBLIC_USE_MOCK_API=true`.

| Route | Methods | Description |
|-------|---------|-------------|
| `/ui-api/notifications` | GET | List notifications |
| `/ui-api/notifications/[id]` | GET, DELETE | Single notification |
| `/ui-api/notifications/[id]/read` | PATCH | Mark as read |
| `/ui-api/notifications/read-bulk` | PATCH | Bulk mark as read |
| `/ui-api/notifications/delete-bulk` | POST | Bulk delete |
| `/ui-api/notifications/channels` | GET | List channels |
| `/ui-api/notifications/channels/[type]` | GET, PUT, DELETE | Channel CRUD |
| `/ui-api/notifications/severity-mappings` | GET, PUT | Severity mappings |
| `/ui-api/notifications/severity-mappings/[severity]` | GET, PUT, DELETE | Single mapping |

## Types

### Core Types

```typescript
type NotificationSeverity = 'info' | 'warning' | 'error' | 'critical'
type SeverityLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
type ChannelType = 'slack' | 'email'
type EventType =
  | 'pipeline_deployed'
  | 'pipeline_stopped'
  | 'pipeline_resumed'
  | 'pipeline_deleted'
  | 'pipeline_failed'
```

### Notification

```typescript
interface Notification {
  notification_id: string
  pipeline_id: string
  timestamp: string
  severity: NotificationSeverity
  event_type: EventType
  title: string
  message: string
  metadata: NotificationMetadata
  created_at: string
  read?: boolean
  read_at?: string | null
  deleted?: boolean
  deleted_at?: string | null
}
```

### Channel

```typescript
interface Channel {
  id: number
  channel_type: ChannelType
  enabled: boolean
  config: SlackChannelConfig | EmailChannelConfig
  created_at: string
  updated_at: string
}

interface SlackChannelConfig {
  webhook_url: string
  default_channel?: string
}

interface EmailChannelConfig {
  smtp_host: string
  smtp_port?: number
  smtp_username: string
  smtp_password: string
  smtp_use_tls?: boolean
  from_address?: string
  from_name?: string
  to_addresses: string
}
```

### SeverityMapping

```typescript
interface SeverityMapping {
  id: number
  severity: SeverityLevel
  channels: ChannelType[]
  created_at: string
  updated_at: string
}
```

### NotificationFilters

```typescript
interface NotificationFilters {
  pipeline_id?: string
  severity?: NotificationSeverity
  read_status?: 'read' | 'unread'
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
  include_deleted?: boolean
}
```

## Feature Flag

**Location:** `src/config/feature-flags.ts`

**Environment Variable:** `NEXT_PUBLIC_NOTIFICATIONS_ENABLED`

```typescript
export const isNotificationsEnabled = (): boolean => {
  return getFeatureFlag('NEXT_PUBLIC_NOTIFICATIONS_ENABLED')
}
```

**Behavior when disabled:**
- NotificationBadge returns null
- NotificationsPanel returns null
- Notifications pages redirect to /home
- API routes return 403 Forbidden

## Pages

### Notifications Page

**Location:** `src/app/notifications/page.tsx`

**Route:** `/notifications`

**Features:**
- Full notification management interface
- Redirects to /home if feature disabled
- Closes slide-out panel on mount
- Fetches notifications on mount

### Settings Page

**Location:** `src/app/notifications/settings/page.tsx`

**Route:** `/notifications/settings`

**Features:**
- Channel configuration
- Severity routing configuration
- Back navigation to notifications page
- Redirects to /home if feature disabled

## User Flows

### Viewing Notifications (Panel)

1. User clicks NotificationBadge in header
2. Panel opens via `togglePanel()` in store
3. Notifications are already loaded (via polling)
4. User can filter, select, and perform actions
5. User clicks outside or navigates away to close

### Viewing Notifications (Full Page)

1. User navigates to /notifications
2. Page checks feature flag, redirects if disabled
3. Closes any open panel
4. Fetches notifications
5. User can use advanced filters
6. User can expand rows for full details

### Configuring Channels

1. User navigates to /notifications/settings
2. Clicks "Configure" on Slack or Email card
3. Dialog opens with appropriate form
4. User fills in configuration
5. Clicks "Save Configuration"
6. API call updates/creates channel
7. Dialog closes, channels refresh

### Configuring Severity Routing

1. User navigates to /notifications/settings
2. Scrolls to Severity Routing section
3. Clicks channel buttons to toggle for each severity
4. "Save Changes" bar appears
5. User clicks "Save Changes"
6. Bulk API call updates all mappings

### Bulk Operations

1. User selects notifications via checkboxes
2. Bulk actions bar appears
3. User clicks "Mark as Read" or "Delete"
4. Bulk API call processes selected items
5. UI updates optimistically
6. Selection is cleared

## Mock Mode

When `NEXT_PUBLIC_USE_MOCK_API=true`, all API routes use mock data from:

**Location:** `src/app/ui-api/mock/data/notifications-state.ts`

Mock functions:
- `getNotificationsFiltered()` - Returns filtered mock notifications
- `getChannels()` / `getChannel()` - Returns mock channel configs
- `updateChannel()` / `deleteChannel()` - Mutates mock channel state
- `getSeverityMappings()` - Returns mock severity mappings
- `updateSeverityMappingsBulk()` - Updates mock mappings

## Dependencies

### Internal Dependencies
- `@/src/store` - Zustand store
- `@/src/services/notifications-api` - API client
- `@/src/config/feature-flags` - Feature flag checks
- `@/src/hooks/useNotifications` - Polling hook
- `@/src/components/ui/*` - UI components (Button, Badge, Sheet, Dialog, etc.)
- `@/src/utils/common.client` - Utility functions (cn, getRuntimeEnv)

### External Dependencies
- `zustand` - State management
- `react` - React hooks and components
- `next/navigation` - Router for redirects
- `next/link` - Client-side navigation
- `lucide-react` - Icons
- `date-fns` - Date formatting (in filters)

## Best Practices

### Feature Flag Checks
- Always check `isNotificationsEnabled()` before rendering notification UI
- Return null early in components when disabled
- Redirect pages to /home when disabled

### State Management
- Use store actions for all state updates
- Don't mutate store state directly
- Use `refreshNotifications()` for silent updates (polling)
- Use `fetchNotifications()` for user-initiated fetches

### API Calls
- Handle loading and error states
- Show appropriate feedback to users
- Update UI optimistically where appropriate
- Refetch data after mutations

### Selection State
- Clear selection after bulk operations
- Use Set for efficient lookup
- Derive `allSelected` from current filtered view

### Mute State
- Persist to localStorage for cross-session persistence
- Use `isHydrated` flag for SSR compatibility
- Dim settings UI when muted (but keep functional)

## Future Improvements

1. **Real-time Updates**
   - WebSocket connection for instant notifications
   - Push notifications support

2. **Enhanced Filtering**
   - Save filter presets
   - Full-text search in messages

3. **Notification Groups**
   - Group by pipeline
   - Collapse similar notifications

4. **Analytics**
   - Track notification interactions
   - Delivery success rates

5. **Additional Channels**
   - PagerDuty integration
   - Microsoft Teams
   - Custom webhooks
