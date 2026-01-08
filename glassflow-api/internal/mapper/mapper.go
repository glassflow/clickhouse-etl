package mapper

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/schema"
)

type MapperInterface interface {
	Get(ctx context.Context, keyName string, data []byte) (any, error)
	GetFieldNames(ctx context.Context) ([]string, error)
	MapData(ctx context.Context, sourceName string, data []byte) (map[string]any, error)
}

type Mapper struct {
	store   Store
	mapping *models.Mapping
}

func NewMapper(pipelineID, mappingType string, dbClient DBClient) *Mapper {
	return &Mapper{
		store: NewMappingStore(dbClient, pipelineID, mappingType),
	}
}

func (m *Mapper) Get(ctx context.Context, keyName string, data []byte) (any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	// Find the mapping field by destination field name
	var targetField *models.MappingField
	for i := range m.mapping.Fields {
		if m.mapping.Fields[i].DestinationField == keyName {
			targetField = &m.mapping.Fields[i]
			break
		}
	}

	if targetField == nil {
		return nil, fmt.Errorf("destination field '%s' not found in mapping", keyName)
	}

	var value any
	var exists bool

	switch m.mapping.Type {
	case "one_to_one":
		// Get value by SourceField and convert to DestinationType
		value, exists = jsonData[targetField.SourceField]
		if !exists {
			return nil, fmt.Errorf("source field '%s' not found in data", targetField.SourceField)
		}
		// Convert using the schema package utilities
		return schema.ConvertValue(
			schema.ClickHouseDataType(targetField.DestinationType),
			schema.KafkaDataType(targetField.SourceType),
			value,
		)

	case "many_to_one":
		// Get value by DestinationField (already in correct type)
		value, exists = jsonData[targetField.DestinationField]
		if !exists {
			return nil, fmt.Errorf("destination field '%s' not found in data", targetField.DestinationField)
		}
		return value, nil

	default:
		return nil, fmt.Errorf("unsupported mapping type: %s", m.mapping.Type)
	}
}

func (m *Mapper) GetFieldNames(ctx context.Context) ([]string, error) {
	fields := make([]string, 0, len(m.mapping.Fields))
	for _, field := range m.mapping.Fields {
		fields = append(fields, field.DestinationField)
	}
	return fields, nil
}

func (m *Mapper) MapData(ctx context.Context, sourceName string, data []byte) (map[string]any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	result := make(map[string]any)

	for _, field := range m.mapping.Fields {
		// Only process fields for the specified source
		if field.SourceID != sourceName {
			continue
		}

		var value any
		var err error

		switch m.mapping.Type {
		case "one_to_one":
			rawValue, exists := jsonData[field.SourceField]
			if !exists {
				continue // Skip missing fields
			}
			value, err = schema.ConvertValue(
				schema.ClickHouseDataType(field.DestinationType),
				schema.KafkaDataType(field.SourceType),
				rawValue,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field '%s': %w", field.SourceField, err)
			}

		case "many_to_one":
			rawValue, exists := jsonData[field.DestinationField]
			if !exists {
				continue // Skip missing fields
			}
			// For many_to_one, we still need to ensure proper type conversion
			// The SourceType in many_to_one represents the type of the aggregated/transformed value
			value, err = schema.ConvertValue(
				schema.ClickHouseDataType(field.DestinationType),
				schema.KafkaDataType(field.SourceType),
				rawValue,
			)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field '%s': %w", field.DestinationField, err)
			}

		default:
			return nil, fmt.Errorf("unsupported mapping type: %s", m.mapping.Type)
		}

		result[field.DestinationField] = value
	}

	return result, nil
}
