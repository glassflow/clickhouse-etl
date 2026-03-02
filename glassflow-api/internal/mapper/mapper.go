package mapper

import (
	"fmt"
	"strings"
	"sync"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

type columnInfo struct {
	idx        int
	columnType ClickHouseDataType
}

type columnMetadata struct {
	columns          []string
	columnLookUpInfo map[string]columnInfo
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
		columnsList := make([]string, len(config))
		lookUpMap := make(map[string]columnInfo)
		i := 0
		for _, field := range config {
			columnsList[i] = field.DestinationField
			lookUpMap[field.DestinationField] = columnInfo{
				idx:        i,
				columnType: ClickHouseDataType(field.DestinationType),
			}
			i++
		}

		metadata = columnMetadata{
			columns:          columnsList,
			columnLookUpInfo: lookUpMap,
		}
		m.mu.Lock()
		m.columnsMetadata[schemaVersionID] = metadata
		m.mu.Unlock()
	}

	values := make([]any, len(metadata.columns))

	parsedJson := gjson.ParseBytes(data)

	var conversionErr error

	parsedJson.ForEach(func(key, value gjson.Result) bool {
		mapping := config[key.String()]

		info, exists := metadata.columnLookUpInfo[mapping.DestinationField]
		if exists {
			sourceType := KafkaDataType(internal.NormalizeToBasicKafkaType(mapping.SourceType))
			convertedValue, err := ConvertValueFromJson(info.columnType, sourceType, value)
			if err != nil {
				conversionErr = fmt.Errorf("failed to convert field %s: %w", sourceType, err)
				return false
			}

			values[info.idx] = convertedValue
		}

		return true
	})

	if conversionErr != nil {
		return nil, conversionErr
	}

	for columnName, info := range metadata.columnLookUpInfo {
		if values[info.idx] != nil {
			continue // Already found via top-level iteration
		}

		mapping, ok := config[columnName]
		if !ok {
			continue // No mapping for this column, skip it
		}

		value := getFieldValue(parsedJson, mapping.SourceField)
		if value.Exists() {
			sourceType := KafkaDataType(internal.NormalizeToBasicKafkaType(mapping.SourceType))
			convertedValue, err := ConvertValueFromJson(info.columnType, sourceType, value)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field %s: %w", sourceType, err)
			}
			values[info.idx] = convertedValue
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
