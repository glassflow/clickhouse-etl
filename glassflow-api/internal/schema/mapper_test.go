package schema

import (
	"encoding/json"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSinkMapping(t *testing.T) {
	columnName := "test_column"
	streamName := "test_stream"
	fieldName := "test_field"
	columnType := "String"

	mapping := NewSinkMapping(columnName, streamName, fieldName, columnType)

	assert.Equal(t, columnName, mapping.ColumnName)
	assert.Equal(t, streamName, mapping.StreamName)
	assert.Equal(t, fieldName, mapping.FieldName)
	assert.Equal(t, ClickHouseDataType(columnType), mapping.ColumnType)
}

func TestConvertStreams(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "field1", FieldType: "string"},
				{FieldName: "field2", FieldType: "int"},
			},
			JoinKeyField: "field1",
		},
		"stream2": {
			Fields: []models.StreamDataField{
				{FieldName: "field3", FieldType: "bool"},
			},
			JoinKeyField: "field3",
		},
	}

	streams := convertStreams(streamsConfig)

	assert.Len(t, streams, 2)

	// Check stream1
	assert.Contains(t, streams, "stream1")
	assert.Equal(t, "field1", streams["stream1"].JoinKey)
	assert.Len(t, streams["stream1"].Fields, 2)
	assert.Equal(t, KafkaDataType("string"), streams["stream1"].Fields["field1"])
	assert.Equal(t, KafkaDataType("int"), streams["stream1"].Fields["field2"])

	// Check stream2
	assert.Contains(t, streams, "stream2")
	assert.Equal(t, "field3", streams["stream2"].JoinKey)
	assert.Len(t, streams["stream2"].Fields, 1)
	assert.Equal(t, KafkaDataType("bool"), streams["stream2"].Fields["field3"])
}

func TestNewMapper(t *testing.T) {
	t.Run("valid configuration", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "field1", FieldType: "string"},
					{FieldName: "field2", FieldType: "int"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
			{ColumnName: "col2", StreamName: "stream1", FieldName: "field2", ColumnType: "Int32"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.NoError(t, err)
		assert.NotNil(t, mapper)
		assert.Len(t, mapper.Streams, 1)
		assert.Len(t, mapper.Columns, 2)
		assert.Len(t, mapper.orderedColumns, 2)
		assert.Equal(t, []string{"col1", "col2"}, mapper.orderedColumns)
	})

	t.Run("no streams", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{}
		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no streams defined")
	})

	t.Run("no fields in stream", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields:       []models.StreamDataField{},
				JoinKeyField: "",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no fields defined")
	})

	t.Run("invalid join key", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "nonexistent_field",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "join key 'nonexistent_field' not found")
	})

	t.Run("no columns", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no columns defined")
	})

	t.Run("stream not found", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "nonexistent_stream", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "stream 'nonexistent_stream' not found")
	})

	t.Run("field not found", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "nonexistent_field", ColumnType: "String"},
		}

		mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "field 'nonexistent_field' not found")
	})
}

func TestGetKey(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "string_field", FieldType: "string"},
				{FieldName: "int_field", FieldType: "int"},
				{FieldName: "bool_field", FieldType: "bool"},
			},
			JoinKeyField: "string_field",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col1", StreamName: "stream1", FieldName: "string_field", ColumnType: "String"},
		{ColumnName: "col2", StreamName: "stream1", FieldName: "int_field", ColumnType: "Int32"},
		{ColumnName: "col3", StreamName: "stream1", FieldName: "bool_field", ColumnType: "Bool"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("get string key", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field": 42, "bool_field": true}`)

		value, err := mapper.getKey("stream1", "string_field", jsonData)
		require.NoError(t, err)
		assert.Equal(t, "test_value", value)
	})

	t.Run("get int key", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field":42, "bool_field": true}`)

		value, err := mapper.getKey("stream1", "int_field", jsonData)
		require.NoError(t, err)
		assert.Equal(t, int64(42), value)
	})

	t.Run("get bool key", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field":42, "bool_field": true}`)

		value, err := mapper.getKey("stream1", "bool_field", jsonData)
		require.NoError(t, err)
		assert.Equal(t, true, value)
	})

	t.Run("key not found", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field":42, "bool_field": true}`)

		_, err := mapper.getKey("stream1", "nonexistent_field", jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "key nonexistent_field not found")
	})

	t.Run("invalid json", func(t *testing.T) {
		jsonData := []byte(`invalid_json`)

		_, err := mapper.getKey("stream1", "string_field", jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse JSON data")
	})
}

func TestGetJoinKey(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
		"stream2": {
			Fields: []models.StreamDataField{
				{FieldName: "data", FieldType: "string"},
			},
			JoinKeyField: "", // No join key defined
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
		{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
		{ColumnName: "col_data", StreamName: "stream2", FieldName: "data", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("get join key", func(t *testing.T) {
		jsonData := []byte(`{"id":"12345","name":"test_name"}`)

		value, err := mapper.GetJoinKey("stream1", jsonData)
		require.NoError(t, err)
		assert.Equal(t, "12345", value)
	})

	t.Run("no join key defined", func(t *testing.T) {
		jsonData := []byte(`{"data":"test_data"}`)

		_, err := mapper.GetJoinKey("stream2", jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "no join key defined")
	})
}

func TestPrepareClickHouseValues(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "string_field", FieldType: "string"},
				{FieldName: "int_field", FieldType: "int"},
				{FieldName: "bool_field", FieldType: "bool"},
			},
			JoinKeyField: "string_field",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col_string", StreamName: "stream1", FieldName: "string_field", ColumnType: "String"},
		{ColumnName: "col_int", StreamName: "stream1", FieldName: "int_field", ColumnType: "Int32"},
		{ColumnName: "col_bool", StreamName: "stream1", FieldName: "bool_field", ColumnType: "Bool"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("prepare values", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field": 42, "bool_field": true}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "test_value", values[0])
		assert.Equal(t, int32(42), values[1])
		assert.Equal(t, true, values[2])
	})

	t.Run("missing field", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "bool_field": true}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "test_value", values[0])
		assert.Nil(t, values[1]) // Missing int_field
		assert.Equal(t, true, values[2])
	})

	t.Run("invalid json", func(t *testing.T) {
		jsonData := []byte(`invalid_json`)

		_, err := mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to prepare values for ClickHouse")
	})

	t.Run("joined streams", func(t *testing.T) {
		joinedMapper, err := NewJSONToClickHouseMapper(
			map[string]models.StreamSchemaConfig{
				"stream1": {
					Fields: []models.StreamDataField{
						{FieldName: "id", FieldType: "string"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "id",
				},
				"stream2": {
					Fields: []models.StreamDataField{
						{FieldName: "id", FieldType: "string"},
						{FieldName: "value", FieldType: "int"},
					},
					JoinKeyField: "id",
				},
			},
			[]models.SinkMappingConfig{
				{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
				{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
				{ColumnName: "col_value", StreamName: "stream2", FieldName: "value", ColumnType: "Int32"},
			},
		)
		require.NoError(t, err)

		jsonData := []byte(`{"stream1.id": "12345", "stream1.name": "test_name", "stream2.id": "12345", "stream2.value": 42}`)

		values, err := joinedMapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "12345", values[0])
		assert.Equal(t, "test_name", values[1])
		assert.Equal(t, int32(42), values[2])
	})
}

func TestGetFieldsMap(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
		{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("get fields map", func(t *testing.T) {
		jsonData := []byte(`{"id":"12345","name":"test_name","extra_field":"ignored"}`)

		fieldsMap, err := mapper.GetFieldsMap("stream1", jsonData)
		require.NoError(t, err)
		assert.Len(t, fieldsMap, 2)
		assert.Equal(t, "12345", fieldsMap["id"])
		assert.Equal(t, "test_name", fieldsMap["name"])
		assert.NotContains(t, fieldsMap, "extra_field")
	})

	t.Run("invalid json", func(t *testing.T) {
		jsonData := []byte(`invalid_json`)

		_, err := mapper.GetFieldsMap("stream1", jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse JSON data")
	})
}

func TestJoinData(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"users": {
			Fields: []models.StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
		"orders": {
			Fields: []models.StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "product", FieldType: "string"},
				{FieldName: "quantity", FieldType: "int"},
			},
			JoinKeyField: "id",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "user_id", StreamName: "users", FieldName: "id", ColumnType: "String"},
		{ColumnName: "user_name", StreamName: "users", FieldName: "name", ColumnType: "String"},
		{ColumnName: "order_id", StreamName: "orders", FieldName: "id", ColumnType: "String"},
		{ColumnName: "product", StreamName: "orders", FieldName: "product", ColumnType: "String"},
		{ColumnName: "quantity", StreamName: "orders", FieldName: "quantity", ColumnType: "Int32"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("join data", func(t *testing.T) {
		userData := []byte(`{"id":"12345","name":"John Doe"}`)
		orderData := []byte(`{"id":"12345","product":"Widget","quantity":5}`)

		joinedData, err := mapper.JoinData("users", userData, "orders", orderData)
		require.NoError(t, err)

		var result map[string]interface{}
		err = json.Unmarshal(joinedData, &result)
		require.NoError(t, err)

		assert.Equal(t, "12345", result["users.id"])
		assert.Equal(t, "John Doe", result["users.name"])
		assert.Equal(t, "12345", result["orders.id"])
		assert.Equal(t, "Widget", result["orders.product"])
		assert.InEpsilon(t, float64(5), result["orders.quantity"], 0.0001)
	})

	t.Run("nil data", func(t *testing.T) {
		userData := []byte(`{"id":"12345","name":"John Doe"}`)

		_, err := mapper.JoinData("users", userData, "orders", nil)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "left or right data is nil")

		_, err = mapper.JoinData("users", nil, "orders", userData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "left or right data is nil")
	})

	t.Run("invalid json", func(t *testing.T) {
		userData := []byte(`{"id":"12345","name":"John Doe"}`)
		invalidData := []byte(`invalid_json`)

		_, err := mapper.JoinData("users", userData, "orders", invalidData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to unmarshal right data")

		_, err = mapper.JoinData("users", invalidData, "orders", userData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to unmarshal left data")
	})
}

func TestGetOrderedColumns(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "field1", FieldType: "string"},
				{FieldName: "field2", FieldType: "int"},
			},
			JoinKeyField: "field1",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		{ColumnName: "col2", StreamName: "stream1", FieldName: "field2", ColumnType: "Int32"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	columns := mapper.GetOrderedColumns()
	assert.Equal(t, []string{"col1", "col2"}, columns)
}

func TestValidateSchema(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"user_stream": {
			Fields: []models.StreamDataField{
				{FieldName: "user_id", FieldType: "string"},
				{FieldName: "username", FieldType: "string"},
				{FieldName: "age", FieldType: "int"},
				{FieldName: "is_active", FieldType: "bool"},
			},
			JoinKeyField: "user_id",
		},
		"order_stream": {
			Fields: []models.StreamDataField{
				{FieldName: "order_id", FieldType: "string"},
				{FieldName: "amount", FieldType: "float"},
				{FieldName: "timestamp", FieldType: "string"},
			},
			JoinKeyField: "order_id",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "col_user_id", StreamName: "user_stream", FieldName: "user_id", ColumnType: "String"},
		{ColumnName: "col_username", StreamName: "user_stream", FieldName: "username", ColumnType: "String"},
		{ColumnName: "col_age", StreamName: "user_stream", FieldName: "age", ColumnType: "Int32"},
		{ColumnName: "col_is_active", StreamName: "user_stream", FieldName: "is_active", ColumnType: "Bool"},
		{ColumnName: "col_order_id", StreamName: "order_stream", FieldName: "order_id", ColumnType: "String"},
		{ColumnName: "col_amount", StreamName: "order_stream", FieldName: "amount", ColumnType: "Float64"},
		{ColumnName: "col_timestamp", StreamName: "order_stream", FieldName: "timestamp", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("valid data with all required fields", func(t *testing.T) {
		validUserData := []byte(`{
			"user_id": "user123",
			"username": "john_doe",
			"age": 30,
			"is_active": true
		}`)

		err := mapper.ValidateSchema("user_stream", validUserData)
		assert.NoError(t, err)
	})

	t.Run("valid data for different stream", func(t *testing.T) {
		validOrderData := []byte(`{
			"order_id": "order456",
			"amount": 99.99,
			"timestamp": "2025-07-24T10:00:00Z"
		}`)

		err := mapper.ValidateSchema("order_stream", validOrderData)
		assert.NoError(t, err)
	})

	t.Run("valid data with extra fields", func(t *testing.T) {
		dataWithExtraFields := []byte(`{
			"user_id": "user123",
			"username": "john_doe",
			"age": 30,
			"is_active": true,
			"extra_field": "extra_value",
			"another_extra": 123
		}`)

		err := mapper.ValidateSchema("user_stream", dataWithExtraFields)
		assert.NoError(t, err)
	})

	t.Run("missing required field", func(t *testing.T) {
		missingFieldData := []byte(`{
			"user_id": "user123",
			"username": "john_doe",
			"age": 30
		}`)

		err := mapper.ValidateSchema("user_stream", missingFieldData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "field 'is_active' not found in data for stream 'user_stream'")
	})

	t.Run("multiple missing fields", func(t *testing.T) {
		partialData := []byte(`{
			"user_id": "user123"
		}`)

		err := mapper.ValidateSchema("user_stream", partialData)
		require.Error(t, err)
		// Should fail on the first missing field it encounters
		assert.Contains(t, err.Error(), "not found in data for stream 'user_stream'")
	})

	t.Run("empty JSON object", func(t *testing.T) {
		emptyData := []byte(`{}`)

		err := mapper.ValidateSchema("user_stream", emptyData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "not found in data for stream 'user_stream'")
	})

	t.Run("stream not found in configuration", func(t *testing.T) {
		validData := []byte(`{
			"some_field": "some_value"
		}`)

		err := mapper.ValidateSchema("nonexistent_stream", validData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "stream 'nonexistent_stream' not found in configuration")
	})

	t.Run("invalid JSON data", func(t *testing.T) {
		invalidJSON := []byte(`{
			"user_id": "user123",
			"username": "john_doe"
			"age": 30  // missing comma
		}`)

		err := mapper.ValidateSchema("user_stream", invalidJSON)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse JSON data")
	})

	t.Run("malformed JSON", func(t *testing.T) {
		malformedJSON := []byte(`not_json_at_all`)

		err := mapper.ValidateSchema("user_stream", malformedJSON)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to parse JSON data")
	})

	t.Run("null values in required fields", func(t *testing.T) {
		nullValueData := []byte(`{
			"user_id": null,
			"username": "john_doe",
			"age": 30,
			"is_active": true
		}`)

		// This should pass validation as the field exists (even though it's null)
		// The ValidateSchema method only checks for field presence, not value validation
		err := mapper.ValidateSchema("user_stream", nullValueData)
		assert.NoError(t, err)
	})

	t.Run("fields with different data types than expected", func(t *testing.T) {
		wrongTypeData := []byte(`{
			"user_id": 123,
			"username": ["array", "instead", "of", "string"],
			"age": "thirty",
			"is_active": "yes"
		}`)

		// This should pass validation as the method only checks for field presence
		// Type validation would be handled elsewhere in the pipeline
		err := mapper.ValidateSchema("user_stream", wrongTypeData)
		assert.NoError(t, err)
	})

	t.Run("nested JSON structure", func(t *testing.T) {
		nestedData := []byte(`{
			"user_id": "user123",
			"username": "john_doe",
			"age": 30,
			"is_active": true,
			"profile": {
				"address": "123 Main St",
				"phone": "555-0123"
			}
		}`)

		err := mapper.ValidateSchema("user_stream", nestedData)
		assert.NoError(t, err)
	})
}

func TestNestedJsonFields(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "user.name", FieldType: "string"},
				{FieldName: "user.address.city", FieldType: "string"},
				{FieldName: "user.address.zip", FieldType: "string"},
				{FieldName: "metadata.timestamp", FieldType: "string"},
				{FieldName: "simple_field", FieldType: "string"},
			},
			JoinKeyField: "user.name",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "user_name", StreamName: "stream1", FieldName: "user.name", ColumnType: "String"},
		{ColumnName: "city", StreamName: "stream1", FieldName: "user.address.city", ColumnType: "String"},
		{ColumnName: "zip", StreamName: "stream1", FieldName: "user.address.zip", ColumnType: "String"},
		{ColumnName: "timestamp", StreamName: "stream1", FieldName: "metadata.timestamp", ColumnType: "String"},
		{ColumnName: "simple", StreamName: "stream1", FieldName: "simple_field", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("prepare values with nested fields", func(t *testing.T) {
		jsonData := []byte(`{
			"user": {
				"name": "John Doe",
				"address": {
					"city": "New York",
					"zip": "10001"
				}
			},
			"metadata": {
				"timestamp": "2023-01-01T00:00:00Z"
			},
			"simple_field": "test_value"
		}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 5)
		assert.Equal(t, "John Doe", values[0])             // user_name
		assert.Equal(t, "New York", values[1])             // city
		assert.Equal(t, "10001", values[2])                // zip
		assert.Equal(t, "2023-01-01T00:00:00Z", values[3]) // timestamp
		assert.Equal(t, "test_value", values[4])           // simple
	})

	t.Run("get join key with nested field", func(t *testing.T) {
		jsonData := []byte(`{
			"user": {
				"name": "John Doe"
			}
		}`)

		key, err := mapper.GetJoinKey("stream1", jsonData)
		require.NoError(t, err)
		assert.Equal(t, "John Doe", key)
	})
}

func TestWholeArrayMapping(t *testing.T) {

	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "tags", FieldType: "array"},
			},
			JoinKeyField: "tags",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "tags_col", StreamName: "stream1", FieldName: "tags", ColumnType: "Array(String)"},
	}

	mCfg := models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     streamsConfig,
		SinkMapping: sinkMappingConfig,
	}

	mapper, err := NewMapper(mCfg)
	require.NoError(t, err)

	t.Run("prepare values with array of strings", func(t *testing.T) {
		jsonData := []byte(`{
			"tags": ["a", "b", "c"]
		}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 1)
		arrayVal, ok := values[0].([]any)
		if !ok {
			// If the value is not a []any, it might be a []interface{} (Go's default for JSON arrays)
			arrayValIface, okIface := values[0].([]interface{})
			if !okIface {
				t.Fatalf("expected []any or []interface{} for array value, got %T", values[0])
			}
			arrayVal = arrayValIface
		}
		assert.Equal(t, 3, len(arrayVal))
		assert.Equal(t, "a", arrayVal[0])
		assert.Equal(t, "b", arrayVal[1])
		assert.Equal(t, "c", arrayVal[2])
	})

	t.Run("test Array(String) specifically", func(t *testing.T) {
		streamsConfig := map[string]models.StreamSchemaConfig{
			"stream1": {
				Fields: []models.StreamDataField{
					{FieldName: "category", FieldType: "array"},
				},
				JoinKeyField: "category",
			},
		}

		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "category_col", StreamName: "stream1", FieldName: "category", ColumnType: "Array(String)"},
		}

		mCfg := models.MapperConfig{
			Type:        internal.SchemaMapperJSONToCHType,
			Streams:     streamsConfig,
			SinkMapping: sinkMappingConfig,
		}

		mapper, err := NewMapper(mCfg)
		require.NoError(t, err)

		jsonData := []byte(`{
			"category": ["electronics", "computers", "laptops"]
		}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 1)
		assert.NotNil(t, values[0])

		// Verify it's an array
		arrayVal, ok := values[0].([]any)
		if !ok {
			arrayValIface, okIface := values[0].([]interface{})
			if !okIface {
				t.Fatalf("expected []any or []interface{} for array value, got %T", values[0])
			}
			arrayVal = arrayValIface
		}
		assert.Equal(t, 3, len(arrayVal))
		assert.Equal(t, "electronics", arrayVal[0])
		assert.Equal(t, "computers", arrayVal[1])
		assert.Equal(t, "laptops", arrayVal[2])
	})
}

func TestArrayElementExtraction(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "tags", FieldType: "array"},
				{FieldName: "user", FieldType: "string"},
				{FieldName: "addresses", FieldType: "array"},
			},
			JoinKeyField: "user",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "primary_tag", StreamName: "stream1", FieldName: "tags[0]", ColumnType: "String"},
		{ColumnName: "secondary_tag", StreamName: "stream1", FieldName: "tags[1]", ColumnType: "String"},
		{ColumnName: "third_tag", StreamName: "stream1", FieldName: "tags[2]", ColumnType: "String"},
		{ColumnName: "all_tags", StreamName: "stream1", FieldName: "tags", ColumnType: "Array(String)"},
		{ColumnName: "primary_address", StreamName: "stream1", FieldName: "addresses[0]", ColumnType: "String"},
		{ColumnName: "secondary_address", StreamName: "stream1", FieldName: "addresses[1]", ColumnType: "String"},
	}

	mCfg := models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     streamsConfig,
		SinkMapping: sinkMappingConfig,
	}

	mapper, err := NewMapper(mCfg)
	require.NoError(t, err)

	t.Run("extract individual array elements", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe",
			"tags": ["urgent", "important", "follow-up"],
			"addresses": ["123 Main St", "456 Oak Ave"]
		}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 6)

		// Check individual array elements
		assert.Equal(t, "urgent", values[0])      // primary_tag
		assert.Equal(t, "important", values[1])   // secondary_tag
		assert.Equal(t, "follow-up", values[2])   // third_tag
		assert.Equal(t, "123 Main St", values[4]) // primary_address
		assert.Equal(t, "456 Oak Ave", values[5]) // secondary_address

		// Check full array
		arrayVal, ok := values[3].([]any)
		if !ok {
			arrayValIface, okIface := values[3].([]interface{})
			if !okIface {
				t.Fatalf("expected []any or []interface{} for array value, got %T", values[3])
			}
			arrayVal = arrayValIface
		}
		assert.Equal(t, 3, len(arrayVal))
		assert.Equal(t, "urgent", arrayVal[0])
		assert.Equal(t, "important", arrayVal[1])
		assert.Equal(t, "follow-up", arrayVal[2])
	})

	t.Run("handle out of bounds array access", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe",
			"tags": ["urgent", "important"]
		}`)

		_, err := mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})

	t.Run("handle missing array field", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe"
		}`)

		_, err := mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})

	t.Run("handle empty array", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe",
			"tags": []
		}`)

		_, err := mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})
}

func TestNestedArrayElementExtraction(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "user", FieldType: "string"},
				{FieldName: "profile", FieldType: "string"},
			},
			JoinKeyField: "user",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "user_name", StreamName: "stream1", FieldName: "user", ColumnType: "String"},
		{ColumnName: "first_skill", StreamName: "stream1", FieldName: "profile.skills[0]", ColumnType: "String"},
		{ColumnName: "second_skill", StreamName: "stream1", FieldName: "profile.skills[1]", ColumnType: "String"},
		{ColumnName: "first_hobby", StreamName: "stream1", FieldName: "profile.hobbies[0]", ColumnType: "String"},
	}

	mCfg := models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     streamsConfig,
		SinkMapping: sinkMappingConfig,
	}

	mapper, err := NewMapper(mCfg)
	require.NoError(t, err)

	t.Run("extract from nested arrays", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe",
			"profile": {
				"skills": ["Go", "Python", "JavaScript"],
				"hobbies": ["reading", "gaming"]
			}
		}`)

		values, err := mapper.PrepareValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 4)

		assert.Equal(t, "john_doe", values[0]) // user_name
		assert.Equal(t, "Go", values[1])       // first_skill
		assert.Equal(t, "Python", values[2])   // second_skill
		assert.Equal(t, "reading", values[3])  // first_hobby
	})

	t.Run("handle missing nested array", func(t *testing.T) {
		jsonData := []byte(`{
			"user": "john_doe",
			"profile": {
				"skills": ["Go"]
			}
		}`)

		_, err := mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})
}

func TestArrayIndexingEdgeCases(t *testing.T) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"stream1": {
			Fields: []models.StreamDataField{
				{FieldName: "data", FieldType: "array"},
			},
			JoinKeyField: "data",
		},
	}

	t.Run("invalid array index syntax", func(t *testing.T) {
		// Test that invalid syntax is caught during data processing, not mapper creation
		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "invalid", StreamName: "stream1", FieldName: "data[abc]", ColumnType: "String"},
		}

		mCfg := models.MapperConfig{
			Type:        internal.SchemaMapperJSONToCHType,
			Streams:     streamsConfig,
			SinkMapping: sinkMappingConfig,
		}

		mapper, err := NewMapper(mCfg)
		require.NoError(t, err) // Mapper creation should succeed

		// The error should occur during data processing
		jsonData := []byte(`{"data": ["a", "b", "c"]}`)
		_, err = mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})

	t.Run("missing closing bracket", func(t *testing.T) {
		// Test that invalid syntax is caught during data processing, not mapper creation
		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "invalid", StreamName: "stream1", FieldName: "data[0", ColumnType: "String"},
		}

		mCfg := models.MapperConfig{
			Type:        internal.SchemaMapperJSONToCHType,
			Streams:     streamsConfig,
			SinkMapping: sinkMappingConfig,
		}

		mapper, err := NewMapper(mCfg)
		require.NoError(t, err) // Mapper creation should succeed

		// The error should occur during data processing
		jsonData := []byte(`{"data": ["a", "b", "c"]}`)
		_, err = mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})

	t.Run("negative array index", func(t *testing.T) {
		sinkMappingConfig := []models.SinkMappingConfig{
			{ColumnName: "invalid", StreamName: "stream1", FieldName: "data[-1]", ColumnType: "String"},
		}

		mCfg := models.MapperConfig{
			Type:        internal.SchemaMapperJSONToCHType,
			Streams:     streamsConfig,
			SinkMapping: sinkMappingConfig,
		}

		mapper, err := NewMapper(mCfg)
		require.NoError(t, err)

		jsonData := []byte(`{"data": ["a", "b", "c"]}`)
		_, err = mapper.PrepareValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "array index out of bounds")
	})
}

func TestParsePathWithArrayIndex(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		expected []PathPart
		valid    bool
	}{
		{
			name:     "simple field",
			path:     "field",
			expected: []PathPart{{Name: "field"}},
			valid:    true,
		},
		{
			name:     "nested field",
			path:     "user.name",
			expected: []PathPart{{Name: "user"}, {Name: "name"}},
			valid:    true,
		},
		{
			name:     "array element",
			path:     "tags[0]",
			expected: []PathPart{{Name: "tags"}, {Index: 0, IsArrayIndex: true}},
			valid:    true,
		},
		{
			name:     "nested array element",
			path:     "user.addresses[1]",
			expected: []PathPart{{Name: "user"}, {Name: "addresses"}, {Index: 1, IsArrayIndex: true}},
			valid:    true,
		},
		{
			name:     "multiple array elements",
			path:     "data[0][1]",
			expected: []PathPart{{Name: "data"}, {Index: 0, IsArrayIndex: true}, {Index: 1, IsArrayIndex: true}},
			valid:    true,
		},
		{
			name:     "empty path",
			path:     "",
			expected: nil,
			valid:    false,
		},
		{
			name:     "invalid syntax - missing closing bracket",
			path:     "tags[0",
			expected: nil,
			valid:    false,
		},
		{
			name:     "invalid syntax - non-numeric index",
			path:     "tags[abc]",
			expected: nil,
			valid:    false,
		},
		{
			name:     "invalid syntax - empty index",
			path:     "tags[]",
			expected: nil,
			valid:    false,
		},
		{
			name:     "invalid syntax - negative index",
			path:     "tags[-1]",
			expected: []PathPart{{Name: "tags"}, {Index: -1, IsArrayIndex: true}},
			valid:    true, // Parsing succeeds, but validation happens later
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parsePathWithArrayIndex(tt.path)
			if tt.valid {
				require.NotNil(t, result)
				assert.Equal(t, tt.expected, result)
			} else {
				assert.Nil(t, result)
			}
		})
	}
}

func TestGetNestedValueWithArrayIndex(t *testing.T) {
	data := map[string]any{
		"user": map[string]any{
			"name": "john",
			"addresses": []any{
				"123 Main St",
				"456 Oak Ave",
			},
		},
		"tags":   []any{"urgent", "important", "follow-up"},
		"simple": "value",
	}

	tests := []struct {
		name     string
		path     string
		expected any
		exists   bool
	}{
		{
			name:     "simple field",
			path:     "simple",
			expected: "value",
			exists:   true,
		},
		{
			name:     "nested field",
			path:     "user.name",
			expected: "john",
			exists:   true,
		},
		{
			name:     "array element",
			path:     "tags[0]",
			expected: "urgent",
			exists:   true,
		},
		{
			name:     "array element second",
			path:     "tags[1]",
			expected: "important",
			exists:   true,
		},
		{
			name:     "nested array element",
			path:     "user.addresses[0]",
			expected: "123 Main St",
			exists:   true,
		},
		{
			name:     "nested array element second",
			path:     "user.addresses[1]",
			expected: "456 Oak Ave",
			exists:   true,
		},
		{
			name:     "out of bounds array access",
			path:     "tags[5]",
			expected: nil,
			exists:   false,
		},
		{
			name:     "negative array index",
			path:     "tags[-1]",
			expected: nil,
			exists:   false,
		},
		{
			name:     "non-existent field",
			path:     "nonexistent",
			expected: nil,
			exists:   false,
		},
		{
			name:     "non-existent nested field",
			path:     "user.nonexistent",
			expected: nil,
			exists:   false,
		},
		{
			name:     "array access on non-array",
			path:     "simple[0]",
			expected: nil,
			exists:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parts := parsePathWithArrayIndex(tt.path)
			if parts == nil {
				assert.False(t, tt.exists)
				return
			}

			result, exists := getNestedValueWithArrayIndex(data, parts)
			assert.Equal(t, tt.exists, exists)
			if tt.exists {
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}
