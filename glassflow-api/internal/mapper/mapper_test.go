package mapper

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewKafkaToClickHouseMapper(t *testing.T) {
	tests := []struct {
		name            string
		fields          []models.Mapping
		expectedColumns []string
		expectedLookup  map[string]columnInfo
	}{
		{
			name: "creates mapper with single field",
			fields: []models.Mapping{
				{
					SourceField:      "user_id",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "user_id",
					DestinationType:  "String",
				},
			},
			expectedColumns: []string{"user_id"},
			expectedLookup: map[string]columnInfo{
				"user_id": {idx: 0, columnType: "String"},
			},
		},
		{
			name: "creates mapper with multiple fields",
			fields: []models.Mapping{
				{
					SourceField:      "id",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "id",
					DestinationType:  "Int64",
				},
				{
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				{
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
			},
			expectedColumns: []string{"id", "name", "is_active"},
			expectedLookup: map[string]columnInfo{
				"id":        {idx: 0, columnType: "Int64"},
				"name":      {idx: 1, columnType: "String"},
				"is_active": {idx: 2, columnType: "Bool"},
			},
		},
		{
			name:            "creates mapper with empty fields",
			fields:          []models.Mapping{},
			expectedColumns: []string{},
			expectedLookup:  map[string]columnInfo{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := NewKafkaToClickHouseMapper(tt.fields)

			assert.NotNil(t, mapper)
			assert.Equal(t, tt.expectedColumns, mapper.columns)
			assert.Equal(t, len(tt.expectedLookup), len(mapper.columnLookUpInfo))

			for col, expectedInfo := range tt.expectedLookup {
				actualInfo, exists := mapper.columnLookUpInfo[col]
				assert.True(t, exists, "column %s should exist in lookup", col)
				assert.Equal(t, expectedInfo.idx, actualInfo.idx)
				assert.Equal(t, expectedInfo.columnType, actualInfo.columnType)
			}
		})
	}
}

func TestKafkaToClickHouseMapper_GetColumnNames(t *testing.T) {
	fields := []models.Mapping{
		{DestinationField: "col1", DestinationType: "String"},
		{DestinationField: "col2", DestinationType: "Int64"},
		{DestinationField: "col3", DestinationType: "Bool"},
	}

	mapper := NewKafkaToClickHouseMapper(fields)
	columns := mapper.GetColumnNames()

	assert.Equal(t, []string{"col1", "col2", "col3"}, columns)
}

func TestKafkaToClickHouseMapper_Map(t *testing.T) {
	tests := []struct {
		name        string
		fields      []models.Mapping
		config      map[string]models.Mapping
		data        []byte
		expected    []any
		expectError bool
		errorMsg    string
	}{
		{
			name: "maps simple string and int fields",
			fields: []models.Mapping{
				{
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				{
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"name":"John","age":30}`),
			expected: []any{"John", int64(30)},
		},
		{
			name: "maps bool and float fields",
			fields: []models.Mapping{
				{
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
				{
					SourceField:      "score",
					SourceType:       string(internal.KafkaTypeFloat64),
					DestinationField: "score",
					DestinationType:  "Float64",
				},
			},
			config: map[string]models.Mapping{
				"is_active": {
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
				"score": {
					SourceField:      "score",
					SourceType:       string(internal.KafkaTypeFloat64),
					DestinationField: "score",
					DestinationType:  "Float64",
				},
			},
			data:     []byte(`{"active":true,"score":95.5}`),
			expected: []any{true, float64(95.5)},
		},
		{
			name: "maps UUID field",
			fields: []models.Mapping{
				{
					SourceField:      "user_id",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
			},
			config: map[string]models.Mapping{
				"user_id": {
					SourceField:      "user_id",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "user_id",
					DestinationType:  "UUID",
				},
			},
			data: []byte(`{"user_id":"123e4567-e89b-12d3-a456-426614174000"}`),
			expected: []any{
				"123e4567-e89b-12d3-a456-426614174000",
			},
		},
		{
			name: "maps nested field using dot notation",
			fields: []models.Mapping{
				{
					SourceField:      "user.email",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "email",
					DestinationType:  "String",
				},
				{
					SourceField:      "user.profile.age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			config: map[string]models.Mapping{
				"email": {
					SourceField:      "user.email",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "email",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "user.profile.age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"user":{"email":"test@example.com","profile":{"age":25}}}`),
			expected: []any{"test@example.com", int64(25)},
		},
		{
			name: "handles missing fields with nil values",
			fields: []models.Mapping{
				{
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				{
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				"age": {
					SourceField:      "age",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "age",
					DestinationType:  "Int64",
				},
			},
			data:     []byte(`{"name":"John"}`),
			expected: []any{"John", nil},
		},
		{
			name: "maps different source and destination field names",
			fields: []models.Mapping{
				{
					SourceField:      "firstName",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "first_name",
					DestinationType:  "String",
				},
				{
					SourceField:      "lastName",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "last_name",
					DestinationType:  "String",
				},
			},
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
			expected: []any{"John", "Doe"},
		},
		{
			name: "maps array field",
			fields: []models.Mapping{
				{
					SourceField:      "tags",
					SourceType:       string(internal.KafkaTypeArray),
					DestinationField: "tags",
					DestinationType:  "Array(String)",
				},
			},
			config: map[string]models.Mapping{
				"tags": {
					SourceField:      "tags",
					SourceType:       string(internal.KafkaTypeArray),
					DestinationField: "tags",
					DestinationType:  "Array(String)",
				},
			},
			data:     []byte(`{"tags":["tag1","tag2","tag3"]}`),
			expected: []any{[]any{"tag1", "tag2", "tag3"}},
		},
		{
			name: "maps multiple data types",
			fields: []models.Mapping{
				{
					SourceField:      "id",
					SourceType:       string(internal.KafkaTypeInt64),
					DestinationField: "id",
					DestinationType:  "Int64",
				},
				{
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
				{
					SourceField:      "active",
					SourceType:       string(internal.KafkaTypeBool),
					DestinationField: "is_active",
					DestinationType:  "Bool",
				},
				{
					SourceField:      "price",
					SourceType:       string(internal.KafkaTypeFloat64),
					DestinationField: "price",
					DestinationType:  "Float64",
				},
			},
			config: map[string]models.Mapping{
				"id": {
					SourceField:      "id",
					SourceType:       string(internal.KafkaTypeInt64),
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
					SourceType:       string(internal.KafkaTypeFloat64),
					DestinationField: "price",
					DestinationType:  "Float64",
				},
			},
			data:     []byte(`{"id":123,"name":"Product","active":true,"price":29.99}`),
			expected: []any{int64(123), "Product", true, float64(29.99)},
		},
		{
			name: "handles empty JSON",
			fields: []models.Mapping{
				{
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
			config: map[string]models.Mapping{
				"name": {
					SourceField:      "name",
					SourceType:       string(internal.KafkaTypeString),
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
			data:     []byte(`{}`),
			expected: []any{nil},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := NewKafkaToClickHouseMapper(tt.fields)
			result, err := mapper.Map(tt.data, tt.config)

			if tt.expectError {
				require.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestKafkaToClickHouseMapper_Map_ComplexScenarios(t *testing.T) {
	t.Run("maps all fields when config has extra unmapped fields", func(t *testing.T) {
		fields := []models.Mapping{
			{
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeInt64),
				DestinationField: "id",
				DestinationType:  "Int64",
			},
		}

		config := map[string]models.Mapping{
			"id": {
				SourceField:      "id",
				SourceType:       string(internal.KafkaTypeInt64),
				DestinationField: "id",
				DestinationType:  "Int64",
			},
			"extra_field": {
				SourceField:      "extra",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "extra_field",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"id":42,"extra":"value"}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{int64(42)}, result)
	})

	t.Run("maintains column order from field definition", func(t *testing.T) {
		fields := []models.Mapping{
			{SourceField: "z_field", DestinationField: "z_field", DestinationType: "String"},
			{SourceField: "a_field", DestinationField: "a_field", DestinationType: "String"},
			{SourceField: "m_field", DestinationField: "m_field", DestinationType: "String"},
		}

		config := map[string]models.Mapping{
			"z_field": {SourceField: "z_field", SourceType: string(internal.KafkaTypeString), DestinationField: "z_field", DestinationType: "String"},
			"a_field": {SourceField: "a_field", SourceType: string(internal.KafkaTypeString), DestinationField: "a_field", DestinationType: "String"},
			"m_field": {SourceField: "m_field", SourceType: string(internal.KafkaTypeString), DestinationField: "m_field", DestinationType: "String"},
		}

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"a_field":"A","m_field":"M","z_field":"Z"}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{"Z", "A", "M"}, result)
		assert.Equal(t, []string{"z_field", "a_field", "m_field"}, mapper.GetColumnNames())
	})

	t.Run("handles deeply nested JSON", func(t *testing.T) {
		fields := []models.Mapping{
			{
				SourceField:      "data.user.profile.contact.email",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "email",
				DestinationType:  "String",
			},
		}

		config := map[string]models.Mapping{
			"email": {
				SourceField:      "data.user.profile.contact.email",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "email",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"data":{"user":{"profile":{"contact":{"email":"deep@test.com"}}}}}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{"deep@test.com"}, result)
	})
}

func TestKafkaToClickHouseMapper_Map_EdgeCases(t *testing.T) {
	t.Run("handles null values in JSON", func(t *testing.T) {
		fields := []models.Mapping{
			{
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		config := map[string]models.Mapping{
			"name": {
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"name":null}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{nil}, result)
	})

	t.Run("handles zero values", func(t *testing.T) {
		fields := []models.Mapping{
			{
				SourceField:      "count",
				SourceType:       string(internal.KafkaTypeInt64),
				DestinationField: "count",
				DestinationType:  "Int64",
			},
			{
				SourceField:      "active",
				SourceType:       string(internal.KafkaTypeBool),
				DestinationField: "active",
				DestinationType:  "Bool",
			},
		}

		config := map[string]models.Mapping{
			"count": {
				SourceField:      "count",
				SourceType:       string(internal.KafkaTypeInt64),
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

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"count":0,"active":false}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{int64(0), false}, result)
	})

	t.Run("handles empty string values", func(t *testing.T) {
		fields := []models.Mapping{
			{
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		config := map[string]models.Mapping{
			"name": {
				SourceField:      "name",
				SourceType:       string(internal.KafkaTypeString),
				DestinationField: "name",
				DestinationType:  "String",
			},
		}

		mapper := NewKafkaToClickHouseMapper(fields)
		data := []byte(`{"name":""}`)

		result, err := mapper.Map(data, config)
		require.NoError(t, err)
		assert.Equal(t, []any{""}, result)
	})
}
