package mapper

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// resultToMap converts an ordered result slice to a column→value map for order-independent assertions.
// Column metadata is built from the config map whose iteration order is non-deterministic,
// so positional checks (result[0] == X) would be flaky.
func resultToMap(t *testing.T, mapper *KafkaToClickHouseMapper, schemaVersionID string, result []any) map[string]any {
	t.Helper()
	columns, err := mapper.GetColumnNames(schemaVersionID)
	require.NoError(t, err)
	require.Equal(t, len(columns), len(result))
	m := make(map[string]any)
	for i, col := range columns {
		m[col] = result[i]
	}
	return m
}

func TestNewKafkaToClickHouseMapper(t *testing.T) {
	t.Run("creates empty mapper", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		assert.NotNil(t, mapper)
		assert.NotNil(t, mapper.columnsMetadata)
		assert.Empty(t, mapper.columnsMetadata)
	})

	t.Run("populates metadata on first Map call", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		config := map[string]models.Mapping{
			"user_id": {
				SourceField:      "user_id",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "user_id",
				DestinationType:  "String",
			},
		}
		_, err := mapper.Map([]byte(`{"user_id":"abc"}`), "v1", config)
		require.NoError(t, err)

		cols, err := mapper.GetColumnNames("v1")
		require.NoError(t, err)
		assert.Equal(t, []string{"user_id"}, cols)
	})

	t.Run("populates metadata with multiple fields", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		config := map[string]models.Mapping{
			"id": {
				SourceField: "id", SourceType: string(internal.KafkaTypeInt),
				DestinationField: "id", DestinationType: "Int64",
			},
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
			"is_active": {
				SourceField: "active", SourceType: string(internal.KafkaTypeBool),
				DestinationField: "is_active", DestinationType: "Bool",
			},
		}
		_, err := mapper.Map([]byte(`{"id":1,"name":"test","active":true}`), "v1", config)
		require.NoError(t, err)

		cols, err := mapper.GetColumnNames("v1")
		require.NoError(t, err)
		assert.Len(t, cols, 3)
		assert.Contains(t, cols, "id")
		assert.Contains(t, cols, "name")
		assert.Contains(t, cols, "is_active")
	})

	t.Run("maintains separate metadata per schema version", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		config1 := map[string]models.Mapping{
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
		}
		config2 := map[string]models.Mapping{
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
			"age": {
				SourceField: "age", SourceType: string(internal.KafkaTypeInt),
				DestinationField: "age", DestinationType: "Int64",
			},
		}

		_, err := mapper.Map([]byte(`{"name":"John"}`), "v1", config1)
		require.NoError(t, err)
		_, err = mapper.Map([]byte(`{"name":"Jane","age":30}`), "v2", config2)
		require.NoError(t, err)

		cols1, err := mapper.GetColumnNames("v1")
		require.NoError(t, err)
		assert.Len(t, cols1, 1)

		cols2, err := mapper.GetColumnNames("v2")
		require.NoError(t, err)
		assert.Len(t, cols2, 2)
	})
}

func TestKafkaToClickHouseMapper_GetColumnNames(t *testing.T) {
	t.Run("returns columns after Map populates metadata", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		config := map[string]models.Mapping{
			"col1": {SourceField: "c1", SourceType: string(internal.KafkaTypeString), DestinationField: "col1", DestinationType: "String"},
			"col2": {SourceField: "c2", SourceType: string(internal.KafkaTypeInt), DestinationField: "col2", DestinationType: "Int64"},
			"col3": {SourceField: "c3", SourceType: string(internal.KafkaTypeBool), DestinationField: "col3", DestinationType: "Bool"},
		}
		_, err := mapper.Map([]byte(`{"c1":"a","c2":1,"c3":true}`), "v1", config)
		require.NoError(t, err)

		columns, err := mapper.GetColumnNames("v1")
		require.NoError(t, err)
		assert.Len(t, columns, 3)
		assert.Contains(t, columns, "col1")
		assert.Contains(t, columns, "col2")
		assert.Contains(t, columns, "col3")
	})

	t.Run("returns error for unknown schema version", func(t *testing.T) {
		mapper := NewKafkaToClickHouseMapper()
		_, err := mapper.GetColumnNames("nonexistent")
		require.Error(t, err)
		assert.Contains(t, err.Error(), "schema version nonexistent not found")
	})
}

func TestKafkaToClickHouseMapper_Map(t *testing.T) {
	tests := []struct {
		name        string
		config      map[string]models.Mapping
		data        []byte
		expected    map[string]any
		expectError bool
		errorMsg    string
	}{
		{
			name: "maps simple string and int fields",
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"name":"John","age":30}`),
			expected: map[string]any{"name": "John", "age": int64(30)},
		},
		{
			name: "maps bool and float fields",
			config: map[string]models.Mapping{
				"is_active": {
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
				"score": {
					SourceField:      "score",
					SourceType:       string(internal.KafkaTypeFloat),
					DestinationField: "score",
					DestinationType:  "Float64",
				},
			},
			data:     []byte(`{"active":true,"score":95.5}`),
			expected: map[string]any{"is_active": true, "score": float64(95.5)},
		},
		{
			name: "maps UUID field",
			config: map[string]models.Mapping{
				"user_id": {
					SourceField:      "user_id",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
			},
			data:     []byte(`{"user_id":"123e4567-e89b-12d3-a456-426614174000"}`),
			expected: map[string]any{"user_id": "123e4567-e89b-12d3-a456-426614174000"},
		},
		{
			name: "maps nested field using dot notation",
			config: map[string]models.Mapping{
				"email": {
					SourceField:      "user.email",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "email",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "user.profile.age",
					SourceType:       string(internal.KafkaTypeInt),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"user":{"email":"test@example.com","profile":{"age":25}}}`),
			expected: map[string]any{"email": "test@example.com", "age": int64(25)},
		},
		{
			name: "maps flat dotted field names",
			config: map[string]models.Mapping{
				"container_image_name": {
					SourceField:      "container.image.name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "container_image_name",
					DestinationType:  "String",
				},
				"host_name": {
					SourceField:      "host.name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "host_name",
					DestinationType:  "String",
				},
			},
			data:     []byte(`{"container.image.name":"my-image","host.name":"server-1"}`),
			expected: map[string]any{"container_image_name": "my-image", "host_name": "server-1"},
		},
		{
			name: "handles missing fields with nil values",
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"name":"John"}`),
			expected: map[string]any{"name": "John", "age": nil},
		},
		{
			name: "maps different source and destination field names",
			config: map[string]models.Mapping{
				"first_name": {
					SourceField:      "firstName",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "first_name",
					DestinationType:  "String",
				},
				"last_name": {
					SourceField:      "lastName",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "last_name",
					DestinationType:  "String",
				},
			},
			data:     []byte(`{"firstName":"John","lastName":"Doe"}`),
			expected: map[string]any{"first_name": "John", "last_name": "Doe"},
		},
		{
			name: "maps array field",
			config: map[string]models.Mapping{
				"tags": {
					SourceField:      "tags",
					SourceType:       string(internal.KafkaTypeArray),
					DestinationField: "tags",
					DestinationType:  "Array(String)",
				},
			},
			data:     []byte(`{"tags":["tag1","tag2","tag3"]}`),
			expected: map[string]any{"tags": []any{"tag1", "tag2", "tag3"}},
		},
		{
			name: "maps multiple data types",
			config: map[string]models.Mapping{
				"id": {
					SourceField:      "id",
					SourceType:       string(internal.KafkaTypeInt),
					DestinationField: "id",
					DestinationType:  "Int64",
				},
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				"is_active": {
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
				"price": {
					SourceField:      "price",
					SourceType:       string(internal.KafkaTypeFloat),
					DestinationField: "price",
					DestinationType:  "Float64",
				},
			},
			data: []byte(`{"id":123,"name":"Product","active":true,"price":29.99}`),
			expected: map[string]any{
				"id": int64(123), "name": "Product",
				"is_active": true, "price": float64(29.99),
			},
		},
		{
			name: "handles empty JSON",
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
			data:     []byte(`{}`),
			expected: map[string]any{"name": nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := NewKafkaToClickHouseMapper()
			result, err := mapper.Map(tt.data, "v1", tt.config)

			if tt.expectError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
				resultMap := resultToMap(t, mapper, "v1", result)
				assert.Equal(t, tt.expected, resultMap)
			}
		})
	}
}

func TestKafkaToClickHouseMapper_Map_ComplexScenarios(t *testing.T) {
	t.Run("maps only configured fields ignoring extra JSON data", func(t *testing.T) {
		config := map[string]models.Mapping{
			"id": {
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeInt),
				DestinationField: "id",
				DestinationType:  "Int64",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"id":42,"extra":"value"}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"id": int64(42)}, resultMap)
	})

	t.Run("caches metadata and reuses across calls with same schema version", func(t *testing.T) {
		config := map[string]models.Mapping{
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper()

		result1, err := mapper.Map([]byte(`{"name":"Alice"}`), "v1", config)
		require.NoError(t, err)
		result1Map := resultToMap(t, mapper, "v1", result1)
		assert.Equal(t, map[string]any{"name": "Alice"}, result1Map)

		// Second call with same schema version reuses cached metadata
		result2, err := mapper.Map([]byte(`{"name":"Bob"}`), "v1", config)
		require.NoError(t, err)
		result2Map := resultToMap(t, mapper, "v1", result2)
		assert.Equal(t, map[string]any{"name": "Bob"}, result2Map)
	})

	t.Run("handles different schema versions independently", func(t *testing.T) {
		config1 := map[string]models.Mapping{
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
		}
		config2 := map[string]models.Mapping{
			"name": {
				SourceField: "name", SourceType: string(internal.KafkaTypeString),
				DestinationField: "name", DestinationType: "String",
			},
			"age": {
				SourceField: "age", SourceType: string(internal.KafkaTypeInt),
				DestinationField: "age", DestinationType: "Int64",
			},
		}

		mapper := NewKafkaToClickHouseMapper()

		result1, err := mapper.Map([]byte(`{"name":"Alice"}`), "v1", config1)
		require.NoError(t, err)
		assert.Len(t, result1, 1)

		result2, err := mapper.Map([]byte(`{"name":"Bob","age":25}`), "v2", config2)
		require.NoError(t, err)
		assert.Len(t, result2, 2)
		result2Map := resultToMap(t, mapper, "v2", result2)
		assert.Equal(t, map[string]any{"name": "Bob", "age": int64(25)}, result2Map)
	})

	t.Run("handles deeply nested JSON", func(t *testing.T) {
		config := map[string]models.Mapping{
			"email": {
				SourceField:      "data.user.profile.contact.email",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "email",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"data":{"user":{"profile":{"contact":{"email":"deep@test.com"}}}}}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"email": "deep@test.com"}, resultMap)
	})
}

func TestKafkaToClickHouseMapper_Map_EdgeCases(t *testing.T) {
	t.Run("handles null values in JSON", func(t *testing.T) {
		config := map[string]models.Mapping{
			"name": {
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"name":null}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"name": nil}, resultMap)
	})

	t.Run("handles zero values", func(t *testing.T) {
		config := map[string]models.Mapping{
			"count": {
				SourceField:      "count",
				SourceType:       string(internal.KafkaTypeInt),
				DestinationField: "count",
				DestinationType:  "Int64",
			},
			"active": {
				SourceField:      "active",
				SourceType:       string(internal.KafkaTypeBool),
				DestinationField: "active",
				DestinationType:  "Bool",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"count":0,"active":false}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"count": int64(0), "active": false}, resultMap)
	})

	t.Run("handles empty string values", func(t *testing.T) {
		config := map[string]models.Mapping{
			"name": {
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"name":""}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"name": ""}, resultMap)
	})

	t.Run("handles empty map in JSON", func(t *testing.T) {
		config := map[string]models.Mapping{
			"id": {
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "id",
				DestinationType:  "String",
			},
			"attributes": {
				SourceField:      "attributes",
				SourceType:       string(internal.KafkaTypeMap),
				DestinationField: "attributes",
				DestinationType:  "Map(String, String)",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"id":"1","attributes":{}}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"id": "1", "attributes": map[string]string{}}, resultMap)
	})

	t.Run("handles null map in JSON returns empty map", func(t *testing.T) {
		config := map[string]models.Mapping{
			"id": {
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "id",
				DestinationType:  "String",
			},
			"resource": {
				SourceField:      "resource",
				SourceType:       string(internal.KafkaTypeMap),
				DestinationField: "resource",
				DestinationType:  "Map(LowCardinality(String), String)",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"id":"1","resource":null}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"id": "1", "resource": map[string]string{}}, resultMap)
	})

	t.Run("handles missing map field in JSON returns empty map", func(t *testing.T) {
		config := map[string]models.Mapping{
			"id": {
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "id",
				DestinationType:  "String",
			},
			"attributes": {
				SourceField:      "attributes",
				SourceType:       string(internal.KafkaTypeMap),
				DestinationField: "attributes",
				DestinationType:  "Map(String, String)",
			},
		}

		mapper := NewKafkaToClickHouseMapper()
		data := []byte(`{"id":"1"}`)

		result, err := mapper.Map(data, "v1", config)
		require.NoError(t, err)
		resultMap := resultToMap(t, mapper, "v1", result)
		assert.Equal(t, map[string]any{"id": "1", "attributes": map[string]string{}}, resultMap)
	})
}
