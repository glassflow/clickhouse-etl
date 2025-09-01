# Nested JSON and Array Support - Beta Release

This beta release adds support for nested JSON structures and array data types in Kafka input streams, enabling direct mapping to ClickHouse nested and array columns without flattening.

## 🚀 New Features

### Nested JSON Support
- **Dot Notation Access**: Extract nested fields using dot notation (e.g., `user.profile.name`)
- **Individual Column Mapping**: Map nested JSON fields to separate ClickHouse columns
- **Automatic Extraction**: Glassflow automatically extracts nested values and maps them to relevant columns
- **Flexible Flattening**: Transform complex nested structures into relational columns

**How it works:**
For nested data in Kafka input, users can map them to individual columns. For example, `user.profile.name` can be mapped to a column named `user_profile`. Glassflow extracts the nested value and maps it to the relevant column, allowing you to flatten complex JSON structures into clean, queryable ClickHouse columns.

### Array Support
- **Whole Array Mapping**: Map entire arrays from JSON to ClickHouse array columns
- **Type Preservation**: Maintain array element types during conversion
- **No Index Extraction**: Support for complete arrays, not individual elements
- **Direct Array-to-Array**: Preserve array structure without flattening

## 📋 Supported Data Types

### Nested JSON
- All primitive types (String, Int32, Float32, etc.)
- Nested objects with unlimited depth
- Mixed nested structures

### Arrays
- `Array(String)` - String arrays
- `Array(Int32)` - Integer arrays  
- `Array(Float32)` - Float arrays
- `Array(UUID)` - UUID arrays
- And other ClickHouse array types

## 🔧 Usage Examples

### Nested JSON Configuration

**Input JSON:**
```json
{
  "id": "123",
  "user": {
    "profile": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "preferences": {
      "theme": "dark",
      "notifications": true
    }
  },
  "metadata": {
    "created_at": "2024-01-01 00:00:00",
    "tags": ["tag1", "tag2"]
  }
}
```

**Schema Configuration:**
```json
{
  "topics": [
    {
      "name": "users",
      "schema": {
        "type": "json",
        "fields": [
          {"name": "id", "type": "string"},
          {"name": "user.profile.name", "type": "string"},
          {"name": "user.profile.email", "type": "string"},
          {"name": "user.preferences.theme", "type": "string"},
          {"name": "user.preferences.notifications", "type": "bool"},
          {"name": "metadata.created_at", "type": "string"},
          {"name": "metadata.tags", "type": "array"}
        ]
      }
    }
  ],
  "sink": {
    "table_mapping": [
      {"source_id": "users", "field_name": "id", "column_name": "id", "column_type": "String"},
      {"source_id": "users", "field_name": "user.profile.name", "column_name": "user_name", "column_type": "String"},
      {"source_id": "users", "field_name": "user.profile.email", "column_name": "user_email", "column_type": "String"},
      {"source_id": "users", "field_name": "user.preferences.theme", "column_name": "theme", "column_type": "String"},
      {"source_id": "users", "field_name": "user.preferences.notifications", "column_name": "notifications_enabled", "column_type": "Bool"},
      {"source_id": "users", "field_name": "metadata.created_at", "column_name": "created_at", "column_type": "DateTime"},
      {"source_id": "users", "field_name": "metadata.tags", "column_name": "tags", "column_type": "Array(String)"}
    ]
  }
}
```

**Result in ClickHouse:**
Instead of storing the entire nested JSON structure, Glassflow extracts specific fields and stores them as individual columns:

| id | user_name | user_email | theme | notifications_enabled | created_at | tags |
|----|-----------|------------|-------|---------------------|------------|------|
| 123 | John Doe | john@example.com | dark | true | 2024-01-01T00:00:00Z | ['tag1', 'tag2'] |

**Key Benefits:**
- **Clean Data Structure**: Complex nested JSON is flattened into relational columns
- **Query Performance**: Direct column access without JSON parsing
- **Flexible Mapping**: Choose which nested fields to extract and how to name them
- **Type Safety**: Proper data type conversion for each extracted field

### Array Configuration

**Input JSON:**
```json
{
  "id": "456",
  "scores": [85, 92, 78, 95],
  "categories": ["sports", "news", "entertainment"],
  "coordinates": [12.34, 56.78]
}
```

**Schema Configuration:**
```json
{
  "topics": [
    {
      "name": "events",
      "schema": {
        "type": "json",
        "fields": [
          {"name": "id", "type": "string"},
          {"name": "scores", "type": "array"},
          {"name": "categories", "type": "array"},
          {"name": "coordinates", "type": "array"}
        ]
      }
    }
  ],
  "sink": {
    "table_mapping": [
      {"source_id": "events", "field_name": "id", "column_name": "id", "column_type": "String"},
      {"source_id": "events", "field_name": "scores", "column_name": "scores", "column_type": "Array(Int32)"},
      {"source_id": "events", "field_name": "categories", "column_name": "categories", "column_type": "Array(String)"},
      {"source_id": "events", "field_name": "coordinates", "column_name": "coordinates", "column_type": "Array(Float32)"}
    ]
  }
}
```

## 🎯 Demo Examples

### Demo Deduplication with Nested Data
The `demo_deduplication.py` example showcases nested JSON processing with deduplication:

**Generated Event Structure (`user_event.json`):**
```json
{
  "event": {
    "id": "93aae576-b956-43d7-9e16-332d245e77c3"
  },
  "user": {
    "id": "cdc056f6-4c6d-480f-81d4-c7c0ce45f449",
    "name": "Mrs. Lauren Patton",
    "email": "christopherevans@example.net"
  },
  "created_at": "2025-07-04 14:39:04",
  "tags": ["tag_886", "tag_155"]
}
```

**Pipeline Configuration (`deduplication_pipeline.json`):**
- **Deduplication**: Enabled with `event.id` as the deduplication key
- **Nested Field Mapping**: 
  - `event.id` → `event_id` (UUID)
  - `user.id` → `user_id` (UUID)
  - `user.name` → `name` (String)
  - `user.email` → `email` (String)
  - `created_at` → `created_at` (DateTime)
  - `tags` → `tags` (Array(String))
- **Time Window**: 1 hour deduplication window

### Demo Join with Nested Data
The `demo_join.py` example demonstrates joining two streams with nested structures:

**User Events Stream (`user_event.json`):**
```json
{
  "event": {
    "id": "93aae576-b956-43d7-9e16-332d245e77c3"
  },
  "user": {
    "id": "cdc056f6-4c6d-480f-81d4-c7c0ce45f449",
    "name": "Mrs. Lauren Patton",
    "email": "christopherevans@example.net"
  },
  "created_at": "2025-07-04 14:39:04",
  "tags": ["tag_886", "tag_155"]
}
```

**Orders Stream (`order_event.json`):**
```json
{
  "order": {
    "id": "7bf124e9-c3e8-443e-8e56-d7065506b597",
    "amount": 7,
    "price": 38.92
  },
  "user": {
    "id": "cdc056f6-4c6d-480f-81d4-c7c0ce45f449"
  },
  "created_at": "2025-07-04 14:40:27",
  "category": ["category_990", "category_802"]
}
```

**Join Configuration (`join_pipeline.json`):**
- **Join Type**: Temporal join with 1-hour time window
- **Join Key**: `user.id` from both streams
- **Nested Field Mapping**:
  - From `user_events`: `user.name` → `name`, `user.email` → `email`
  - From `orders`: `order.id` → `order_id`, `order.amount` → `amount`, `order.price` → `price`
  - Arrays: `tags` → `tags`, `category` → `category`

## 🐳 Deployment

### Docker Images
- **Backend**: `docker.io/glassflow/clickhouse-etl-be:7654d985fa07f124cf5e34ca824a801158ce691c-beta`
- **Frontend**: `docker.io/glassflow/clickhouse-etl-fe:7654d985fa07f124cf5e34ca824a801158ce691c-beta`

### Docker Compose Example
```yaml
services:
  nats:
    image: nats:alpine
    ports:
      - 4222:4222
    command: --js
    restart: unless-stopped

  ui:
    image: docker.io/glassflow/clickhouse-etl-fe:7654d985fa07f124cf5e34ca824a801158ce691c-beta
    pull_policy: always
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://app:8080/api/v1}
      - NEXT_PUBLIC_IN_DOCKER=${NEXT_PUBLIC_IN_DOCKER:-true}
      - NEXT_PUBLIC_PREVIEW_MODE=${NEXT_PUBLIC_PREVIEW_MODE:-false}

  app:
    image: docker.io/glassflow/clickhouse-etl-be:7654d985fa07f124cf5e34ca824a801158ce691c-beta
    pull_policy: always
    depends_on:
      - nats
    restart: unless-stopped
    environment:
      GLASSFLOW_LOG_FILE_PATH: /tmp/logs/glassflow
      GLASSFLOW_NATS_SERVER: nats:4222
    volumes:
      - logs:/tmp/logs/glassflow

  nginx:
    image: nginx:1.27-alpine
    ports:
      - 8080:8080
    depends_on:
      - ui
      - app
    volumes:
      - logs:/logs:ro
      - ./nginx:/etc/nginx/templates
    restart: unless-stopped
    environment:
      NGINX_ENTRYPOINT_LOCAL_RESOLVERS: true

volumes:
  logs:
```

## ⚠️ Important Notes

### Beta Release Limitations
- This is a beta release for customer evaluation
- Some edge cases may not be fully tested
- Performance characteristics may differ from production releases

### Known Limitations
- Array indexing (e.g., `items[0].name`) is not supported
- Only whole array mapping is available
- Nested array structures require careful schema design

## 🆘 Support

For issues or questions related to this beta release:
- Check the demo examples for usage patterns
- Review the test cases for edge case handling
- Contact the development team for beta-specific support

---

**Branch**: `nested-json`  
**Version**: Beta Release  
**Build**: `7654d985fa07f124cf5e34ca824a801158ce691c`
