package schema

import (
	"encoding/json"
	"testing"

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
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "field1", FieldType: "string"},
				{FieldName: "field2", FieldType: "int"},
			},
			JoinKeyField: "field1",
		},
		"stream2": {
			Fields: []StreamDataField{
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
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields: []StreamDataField{
					{FieldName: "field1", FieldType: "string"},
					{FieldName: "field2", FieldType: "int"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
			{ColumnName: "col2", StreamName: "stream1", FieldName: "field2", ColumnType: "Int32"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.NoError(t, err)
		assert.NotNil(t, mapper)
		assert.Len(t, mapper.Streams, 1)
		assert.Len(t, mapper.Columns, 2)
		assert.Len(t, mapper.orderedColumns, 2)
		assert.Equal(t, []string{"col1", "col2"}, mapper.orderedColumns)
	})

	t.Run("no streams", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{}
		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no streams defined")
	})

	t.Run("no fields in stream", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields:       []StreamDataField{},
				JoinKeyField: "",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no fields defined")
	})

	t.Run("invalid join key", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields: []StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "nonexistent_field",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "join key 'nonexistent_field' not found")
	})

	t.Run("no columns", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields: []StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "no columns defined")
	})

	t.Run("stream not found", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields: []StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "nonexistent_stream", FieldName: "field1", ColumnType: "String"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "stream 'nonexistent_stream' not found")
	})

	t.Run("field not found", func(t *testing.T) {
		streamsConfig := map[string]StreamSchemaConfig{
			"stream1": {
				Fields: []StreamDataField{
					{FieldName: "field1", FieldType: "string"},
				},
				JoinKeyField: "field1",
			},
		}

		sinkMappingConfig := []SinkMappingConfig{
			{ColumnName: "col1", StreamName: "stream1", FieldName: "nonexistent_field", ColumnType: "String"},
		}

		mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
		require.Error(t, err)
		assert.Nil(t, mapper)
		assert.Contains(t, err.Error(), "field 'nonexistent_field' not found")
	})
}

func TestGetKey(t *testing.T) {
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "string_field", FieldType: "string"},
				{FieldName: "int_field", FieldType: "int"},
				{FieldName: "bool_field", FieldType: "bool"},
			},
			JoinKeyField: "string_field",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col1", StreamName: "stream1", FieldName: "string_field", ColumnType: "String"},
		{ColumnName: "col2", StreamName: "stream1", FieldName: "int_field", ColumnType: "Int32"},
		{ColumnName: "col3", StreamName: "stream1", FieldName: "bool_field", ColumnType: "Bool"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
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
		assert.Contains(t, err.Error(), "failed to read JSON token")
	})
}

func TestGetJoinKey(t *testing.T) {
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
		"stream2": {
			Fields: []StreamDataField{
				{FieldName: "data", FieldType: "string"},
			},
			JoinKeyField: "", // No join key defined
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
		{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
		{ColumnName: "col_data", StreamName: "stream2", FieldName: "data", ColumnType: "String"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
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
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "string_field", FieldType: "string"},
				{FieldName: "int_field", FieldType: "int"},
				{FieldName: "bool_field", FieldType: "bool"},
			},
			JoinKeyField: "string_field",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col_string", StreamName: "stream1", FieldName: "string_field", ColumnType: "String"},
		{ColumnName: "col_int", StreamName: "stream1", FieldName: "int_field", ColumnType: "Int32"},
		{ColumnName: "col_bool", StreamName: "stream1", FieldName: "bool_field", ColumnType: "Bool"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	t.Run("prepare values", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "int_field": 42, "bool_field": true}`)

		values, err := mapper.PrepareClickHouseValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "test_value", values[0])
		assert.Equal(t, int32(42), values[1])
		assert.Equal(t, true, values[2])
	})

	t.Run("missing field", func(t *testing.T) {
		jsonData := []byte(`{"string_field": "test_value", "bool_field": true}`)

		values, err := mapper.PrepareClickHouseValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "test_value", values[0])
		assert.Nil(t, values[1]) // Missing int_field
		assert.Equal(t, true, values[2])
	})

	t.Run("invalid json", func(t *testing.T) {
		jsonData := []byte(`invalid_json`)

		_, err := mapper.PrepareClickHouseValues(jsonData)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to prepare values for ClickHouse")
	})

	t.Run("joined streams", func(t *testing.T) {
		joinedMapper, err := NewMapper(
			map[string]StreamSchemaConfig{
				"stream1": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "string"},
						{FieldName: "name", FieldType: "string"},
					},
					JoinKeyField: "id",
				},
				"stream2": {
					Fields: []StreamDataField{
						{FieldName: "id", FieldType: "string"},
						{FieldName: "value", FieldType: "int"},
					},
					JoinKeyField: "id",
				},
			},
			[]SinkMappingConfig{
				{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
				{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
				{ColumnName: "col_value", StreamName: "stream2", FieldName: "value", ColumnType: "Int32"},
			},
		)
		require.NoError(t, err)

		jsonData := []byte(`{"stream1.id": "12345", "stream1.name": "test_name", "stream2.id": "12345", "stream2.value": 42}`)

		values, err := joinedMapper.PrepareClickHouseValues(jsonData)
		require.NoError(t, err)
		assert.Len(t, values, 3)
		assert.Equal(t, "12345", values[0])
		assert.Equal(t, "test_name", values[1])
		assert.Equal(t, int32(42), values[2])
	})
}

func TestGetFieldsMap(t *testing.T) {
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col_id", StreamName: "stream1", FieldName: "id", ColumnType: "String"},
		{ColumnName: "col_name", StreamName: "stream1", FieldName: "name", ColumnType: "String"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
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
	streamsConfig := map[string]StreamSchemaConfig{
		"users": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "name", FieldType: "string"},
			},
			JoinKeyField: "id",
		},
		"orders": {
			Fields: []StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "product", FieldType: "string"},
				{FieldName: "quantity", FieldType: "int"},
			},
			JoinKeyField: "id",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "user_id", StreamName: "users", FieldName: "id", ColumnType: "String"},
		{ColumnName: "user_name", StreamName: "users", FieldName: "name", ColumnType: "String"},
		{ColumnName: "order_id", StreamName: "orders", FieldName: "id", ColumnType: "String"},
		{ColumnName: "product", StreamName: "orders", FieldName: "product", ColumnType: "String"},
		{ColumnName: "quantity", StreamName: "orders", FieldName: "quantity", ColumnType: "Int32"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
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
	streamsConfig := map[string]StreamSchemaConfig{
		"stream1": {
			Fields: []StreamDataField{
				{FieldName: "field1", FieldType: "string"},
				{FieldName: "field2", FieldType: "int"},
			},
			JoinKeyField: "field1",
		},
	}

	sinkMappingConfig := []SinkMappingConfig{
		{ColumnName: "col1", StreamName: "stream1", FieldName: "field1", ColumnType: "String"},
		{ColumnName: "col2", StreamName: "stream1", FieldName: "field2", ColumnType: "Int32"},
	}

	mapper, err := NewMapper(streamsConfig, sinkMappingConfig)
	require.NoError(t, err)

	columns := mapper.GetOrderedColumns()
	assert.Equal(t, []string{"col1", "col2"}, columns)
}
