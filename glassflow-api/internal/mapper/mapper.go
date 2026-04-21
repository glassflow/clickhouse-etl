package mapper

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

type columnInfo struct {
	idx         int
	columnType  ClickHouseDataType
	sourceField string
	sourceType  KafkaDataType
}

type columnMetadata struct {
	columns          []string
	columnLookUpInfo map[string]columnInfo // keyed by source field name
}

type KafkaToClickHouseMapper struct {
	columnsMetadata map[string]columnMetadata
	mu              sync.RWMutex
}

func NewKafkaToClickHouseMapper() *KafkaToClickHouseMapper {
	return &KafkaToClickHouseMapper{
		columnsMetadata: make(map[string]columnMetadata),
	}
}

func (m *KafkaToClickHouseMapper) Map(data []byte, schemaVersionID string, config map[string]models.Mapping) ([]any, error) {
	m.mu.RLock()
	metadata, exists := m.columnsMetadata[schemaVersionID]
	m.mu.RUnlock()
	if !exists {
		// Sort config keys for deterministic column ordering
		sortedKeys := make([]string, 0, len(config))
		for k := range config {
			sortedKeys = append(sortedKeys, k)
		}
		sort.Strings(sortedKeys)

		columnsList := make([]string, len(config))
		lookUpMap := make(map[string]columnInfo)
		for idx, key := range sortedKeys {
			field := config[key]
			columnsList[idx] = field.DestinationField
			lookUpMap[field.SourceField] = columnInfo{
				idx:         idx,
				columnType:  ClickHouseDataType(field.DestinationType),
				sourceField: field.SourceField,
				sourceType:  KafkaDataType(internal.NormalizeToBasicKafkaType(field.SourceType)),
			}
		}

		metadata = columnMetadata{
			columns:          columnsList,
			columnLookUpInfo: lookUpMap,
		}
		m.mu.Lock()
		if existing, alreadyExists := m.columnsMetadata[schemaVersionID]; alreadyExists {
			metadata = existing
		} else {
			m.columnsMetadata[schemaVersionID] = metadata
		}
		m.mu.Unlock()
	}

	values := make([]any, len(metadata.columns))

	parsedJson := gjson.ParseBytes(data)

	var conversionErr error

	parsedJson.ForEach(func(key, value gjson.Result) bool {
		info, exists := metadata.columnLookUpInfo[key.String()]
		if exists {
			convertedValue, err := ConvertValueFromJson(info.columnType, info.sourceType, value)
			if err != nil {
				conversionErr = fmt.Errorf("failed to convert field %s: %w", key.String(), err)
				return false
			}

			values[info.idx] = convertedValue
		}

		return true
	})

	if conversionErr != nil {
		return nil, conversionErr
	}

	// Fallback for dotted source field names (e.g. "container.image.name") that
	// ForEach cannot resolve as top-level keys when stored as nested JSON objects.
	for _, info := range metadata.columnLookUpInfo {
		if values[info.idx] != nil {
			continue // Already found via top-level ForEach iteration
		}

		value := getFieldValue(parsedJson, info.sourceField)
		if value.Exists() {
			convertedValue, err := ConvertValueFromJson(info.columnType, info.sourceType, value)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field %s: %w", info.sourceField, err)
			}
			values[info.idx] = convertedValue
		} else if strings.HasPrefix(string(info.columnType), "Map(") {
			// Map types cannot be NULL in ClickHouse; use empty map for missing fields
			values[info.idx] = map[string]string{}
		}
	}

	return values, nil
}

func (m *KafkaToClickHouseMapper) GetColumnNames(schemaVersionID string) ([]string, error) {
	m.mu.RLock()
	metadata, exists := m.columnsMetadata[schemaVersionID]
	m.mu.RUnlock()
	if !exists {
		return nil, fmt.Errorf("schema version %s not found in mapper metadata", schemaVersionID)
	}
	return metadata.columns, nil
}

// getFieldValue retrieves a field value from a parsed gjson result, supporting both
// literal dotted keys (e.g. "container.image.name": "value") and nested object paths
// (e.g. {"container": {"image": {"name": "value"}}}). It tries the escaped (literal) path
// first, then falls back to the unescaped (nested) path.
func getFieldValue(parsedMsg gjson.Result, fieldName string) gjson.Result {
	if strings.Contains(fieldName, ".") {
		fieldValue := parsedMsg.Get(strings.ReplaceAll(fieldName, ".", `\.`))
		if fieldValue.Exists() {
			return fieldValue
		}
	}

	return parsedMsg.Get(fieldName)
}
