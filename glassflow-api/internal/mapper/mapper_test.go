package mapper

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMapper_Get_OneToOne(t *testing.T) {
	tests := []struct {
		name          string
		mapping       *models.Mapping
		keyName       string
		inputData     map[string]any
		expectedValue any
		expectedError string
	}{
		{
			name: "successful conversion - string to string",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "user_name",
						SourceType:       "string",
						DestinationField: "name",
						DestinationType:  "String",
					},
				},
			},
			keyName: "name",
			inputData: map[string]any{
				"user_name": "John Doe",
			},
			expectedValue: "John Doe",
		},
		{
			name: "successful conversion - int to int32",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "age",
						SourceType:       "int",
						DestinationField: "user_age",
						DestinationType:  "Int32",
					},
				},
			},
			keyName: "user_age",
			inputData: map[string]any{
				"age": float64(25), // JSON numbers are float64
			},
			expectedValue: int32(25),
		},
		{
			name: "successful conversion - float to float64",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "price",
						SourceType:       "float",
						DestinationField: "product_price",
						DestinationType:  "Float64",
					},
				},
			},
			keyName: "product_price",
			inputData: map[string]any{
				"price": 99.99,
			},
			expectedValue: 99.99,
		},
		{
			name: "destination field not found in mapping",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "user_name",
						SourceType:       "string",
						DestinationField: "name",
						DestinationType:  "String",
					},
				},
			},
			keyName:       "unknown_field",
			inputData:     map[string]any{"user_name": "John"},
			expectedError: "destination field 'unknown_field' not found in mapping",
		},
		{
			name: "source field not found in data",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "user_name",
						SourceType:       "string",
						DestinationField: "name",
						DestinationType:  "String",
					},
				},
			},
			keyName:       "name",
			inputData:     map[string]any{"other_field": "value"},
			expectedError: "source field 'user_name' not found in data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := &Mapper{
				mapping: tt.mapping,
			}

			data, err := json.Marshal(tt.inputData)
			require.NoError(t, err)

			result, err := mapper.Get(context.Background(), tt.keyName, data)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedValue, result)
			}
		})
	}
}

func TestMapper_Get_ManyToOne(t *testing.T) {
	tests := []struct {
		name          string
		mapping       *models.Mapping
		keyName       string
		inputData     map[string]any
		expectedValue any
		expectedError string
	}{
		{
			name: "successful retrieval - value already in correct type",
			mapping: &models.Mapping{
				Type: "many_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "full_name",
						SourceType:       "string",
						DestinationField: "full_name",
						DestinationType:  "String",
					},
				},
			},
			keyName: "full_name",
			inputData: map[string]any{
				"full_name": "John Doe",
			},
			expectedValue: "John Doe",
		},
		{
			name: "destination field not found in data",
			mapping: &models.Mapping{
				Type: "many_to_one",
				Fields: []models.MappingField{
					{
						SourceField:      "full_name",
						SourceType:       "string",
						DestinationField: "full_name",
						DestinationType:  "String",
					},
				},
			},
			keyName:       "full_name",
			inputData:     map[string]any{"other_field": "value"},
			expectedError: "destination field 'full_name' not found in data",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := &Mapper{
				mapping: tt.mapping,
			}

			data, err := json.Marshal(tt.inputData)
			require.NoError(t, err)

			result, err := mapper.Get(context.Background(), tt.keyName, data)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedValue, result)
			}
		})
	}
}

func TestMapper_Get_InvalidJSON(t *testing.T) {
	mapper := &Mapper{
		mapping: &models.Mapping{
			Type: "one_to_one",
			Fields: []models.MappingField{
				{
					SourceField:      "user_name",
					SourceType:       "string",
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
		},
	}

	invalidJSON := []byte("{invalid json}")

	_, err := mapper.Get(context.Background(), "name", invalidJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse JSON data")
}

func TestMapper_Get_UnsupportedMappingType(t *testing.T) {
	mapper := &Mapper{
		mapping: &models.Mapping{
			Type: "unsupported_type",
			Fields: []models.MappingField{
				{
					SourceField:      "user_name",
					SourceType:       "string",
					DestinationField: "name",
					DestinationType:  "String",
				},
			},
		},
	}

	data, err := json.Marshal(map[string]any{"user_name": "John"})
	require.NoError(t, err)

	_, err = mapper.Get(context.Background(), "name", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported mapping type: unsupported_type")
}

func TestMapper_GetFieldNames(t *testing.T) {
	tests := []struct {
		name           string
		mapping        *models.Mapping
		expectedFields []string
	}{
		{
			name: "single field",
			mapping: &models.Mapping{
				Fields: []models.MappingField{
					{DestinationField: "name"},
				},
			},
			expectedFields: []string{"name"},
		},
		{
			name: "multiple fields",
			mapping: &models.Mapping{
				Fields: []models.MappingField{
					{DestinationField: "name"},
					{DestinationField: "age"},
					{DestinationField: "email"},
				},
			},
			expectedFields: []string{"name", "age", "email"},
		},
		{
			name: "empty mapping",
			mapping: &models.Mapping{
				Fields: []models.MappingField{},
			},
			expectedFields: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := &Mapper{
				mapping: tt.mapping,
			}

			fields, err := mapper.GetFieldNames(context.Background())
			require.NoError(t, err)
			assert.Equal(t, tt.expectedFields, fields)
		})
	}
}

func TestMapper_MapData_OneToOne(t *testing.T) {
	tests := []struct {
		name           string
		mapping        *models.Mapping
		sourceName     string
		inputData      map[string]any
		expectedResult map[string]any
		expectedError  string
	}{
		{
			name: "successful mapping - single field",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "user_name",
						SourceType:       "string",
						DestinationField: "name",
						DestinationType:  "String",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"user_name": "John Doe",
			},
			expectedResult: map[string]any{
				"name": "John Doe",
			},
		},
		{
			name: "successful mapping - multiple fields",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "user_name",
						SourceType:       "string",
						DestinationField: "name",
						DestinationType:  "String",
					},
					{
						SourceID:         "source1",
						SourceField:      "user_age",
						SourceType:       "int",
						DestinationField: "age",
						DestinationType:  "Int32",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"user_name": "John Doe",
				"user_age":  float64(30),
			},
			expectedResult: map[string]any{
				"name": "John Doe",
				"age":  int32(30),
			},
		},
		{
			name: "filter by source - only matching source",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "field1",
						SourceType:       "string",
						DestinationField: "dest1",
						DestinationType:  "String",
					},
					{
						SourceID:         "source2",
						SourceField:      "field2",
						SourceType:       "string",
						DestinationField: "dest2",
						DestinationType:  "String",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"field1": "value1",
				"field2": "value2",
			},
			expectedResult: map[string]any{
				"dest1": "value1",
			},
		},
		{
			name: "skip missing fields",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "existing_field",
						SourceType:       "string",
						DestinationField: "dest1",
						DestinationType:  "String",
					},
					{
						SourceID:         "source1",
						SourceField:      "missing_field",
						SourceType:       "string",
						DestinationField: "dest2",
						DestinationType:  "String",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"existing_field": "value1",
			},
			expectedResult: map[string]any{
				"dest1": "value1",
			},
		},
		{
			name: "type conversion error",
			mapping: &models.Mapping{
				Type: "one_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "field1",
						SourceType:       "string",
						DestinationField: "dest1",
						DestinationType:  "Bool", // Wrong type for string data
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"field1": "not_a_bool",
			},
			expectedError: "failed to convert field 'field1'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := &Mapper{
				mapping: tt.mapping,
			}

			data, err := json.Marshal(tt.inputData)
			require.NoError(t, err)

			result, err := mapper.MapData(context.Background(), tt.sourceName, data)

			if tt.expectedError != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.expectedError)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

func TestMapper_MapData_ManyToOne(t *testing.T) {
	tests := []struct {
		name           string
		mapping        *models.Mapping
		sourceName     string
		inputData      map[string]any
		expectedResult map[string]any
	}{
		{
			name: "successful mapping - values already in correct type",
			mapping: &models.Mapping{
				Type: "many_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "full_name",
						SourceType:       "string",
						DestinationField: "full_name",
						DestinationType:  "String",
					},
					{
						SourceID:         "source1",
						SourceField:      "total_age",
						SourceType:       "int",
						DestinationField: "total_age",
						DestinationType:  "Int32",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"full_name": "John Doe",
				"total_age": 30, // JSON numbers unmarshal as float64
			},
			expectedResult: map[string]any{
				"full_name": "John Doe",
				"total_age": int32(30), // Now properly converted
			},
		},
		{
			name: "skip missing fields in many_to_one",
			mapping: &models.Mapping{
				Type: "many_to_one",
				Fields: []models.MappingField{
					{
						SourceID:         "source1",
						SourceField:      "existing_field",
						SourceType:       "string",
						DestinationField: "existing_field",
						DestinationType:  "String",
					},
					{
						SourceID:         "source1",
						SourceField:      "missing_field",
						SourceType:       "string",
						DestinationField: "missing_field",
						DestinationType:  "String",
					},
				},
			},
			sourceName: "source1",
			inputData: map[string]any{
				"existing_field": "value1",
			},
			expectedResult: map[string]any{
				"existing_field": "value1",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mapper := &Mapper{
				mapping: tt.mapping,
			}

			data, err := json.Marshal(tt.inputData)
			require.NoError(t, err)

			result, err := mapper.MapData(context.Background(), tt.sourceName, data)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedResult, result)
		})
	}
}

func TestMapper_MapData_InvalidJSON(t *testing.T) {
	mapper := &Mapper{
		mapping: &models.Mapping{
			Type: "one_to_one",
			Fields: []models.MappingField{
				{
					SourceID:         "source1",
					SourceField:      "field1",
					SourceType:       "string",
					DestinationField: "dest1",
					DestinationType:  "String",
				},
			},
		},
	}

	invalidJSON := []byte("{invalid json}")

	_, err := mapper.MapData(context.Background(), "source1", invalidJSON)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "failed to parse JSON data")
}

func TestMapper_MapData_UnsupportedMappingType(t *testing.T) {
	mapper := &Mapper{
		mapping: &models.Mapping{
			Type: "unsupported_type",
			Fields: []models.MappingField{
				{
					SourceID:         "source1",
					SourceField:      "field1",
					SourceType:       "string",
					DestinationField: "dest1",
					DestinationType:  "String",
				},
			},
		},
	}

	data, err := json.Marshal(map[string]any{"field1": "value1"})
	require.NoError(t, err)

	_, err = mapper.MapData(context.Background(), "source1", data)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported mapping type: unsupported_type")
}
