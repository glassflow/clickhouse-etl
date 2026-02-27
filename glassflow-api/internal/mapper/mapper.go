package mapper

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

type columnInfo struct {
	idx        int
	columnType ClickHouseDataType
}

type KafkaToClickHouseMapper struct {
	columns          []string
	columnLookUpInfo map[string]columnInfo
}

func NewKafkaToClickHouseMapper(fields []models.Mapping) *KafkaToClickHouseMapper {
	columns := make([]string, len(fields))
	lookUpMap := make(map[string]columnInfo)
	for idx, field := range fields {
		columns[idx] = field.DestinationField
		lookUpMap[field.DestinationField] = columnInfo{
			idx:        idx,
			columnType: ClickHouseDataType(field.DestinationType),
		}
	}

	return &KafkaToClickHouseMapper{
		columns:          columns,
		columnLookUpInfo: lookUpMap,
	}
}

func (m *KafkaToClickHouseMapper) Map(data []byte, config map[string]models.Mapping) ([]any, error) {
	values := make([]any, len(m.columns))

	parsedJson := gjson.ParseBytes(data)

	var conversionErr error

	parsedJson.ForEach(func(key, value gjson.Result) bool {
		mapping := config[key.String()]

		info, exists := m.columnLookUpInfo[mapping.DestinationField]
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

	for columnName, info := range m.columnLookUpInfo {
		if values[info.idx] != nil {
			continue // Already found via top-level iteration
		}

		mapping, ok := config[columnName]
		if !ok {
			continue // No mapping for this column, skip it
		}

		value := parsedJson.Get(mapping.SourceField)
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

func (m *KafkaToClickHouseMapper) GetColumnNames() []string {
	return m.columns
}
