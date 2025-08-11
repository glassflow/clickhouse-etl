package schema

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Mapper interface {
	GetJoinKey(streamSchemaName string, data []byte) (any, error)
	GetKey(streamSchemaName, keyName string, data []byte) (any, error)
	GetOrderedColumns() []string
	PrepareValues(data []byte) ([]any, error)
	GetFieldsMap(streamSchemaName string, data []byte) (map[string]any, error)
	JoinData(leftStreamName string, leftData []byte, rightStreamName string, rightData []byte) ([]byte, error)
	ValidateSchema(streamSchemaName string, data []byte) error
}

type Stream struct {
	Fields          map[string]KafkaDataType
	JoinKey         string
	JoinOrientation string
	JoinWindow      time.Duration
}

type SinkMapping struct {
	ColumnName string
	StreamName string
	FieldName  string
	ColumnType ClickHouseDataType
}

func NewMapper(cfg models.MapperConfig) (Mapper, error) {
	if cfg.Type != "jsonToClickhouse" {
		return nil, fmt.Errorf("unsupported mapper type: %s", cfg.Type)
	}

	mapper, err := NewJSONToClickHouseMapper(cfg.Streams, cfg.SinkMapping)
	if err != nil {
		return nil, fmt.Errorf("failed to create JsonToClickHouseMapper: %w", err)
	}

	return mapper, nil
}

func NewSinkMapping(columnName, streamName, fieldName, columnType string) *SinkMapping {
	return &SinkMapping{
		ColumnName: columnName,
		StreamName: streamName,
		FieldName:  fieldName,
		ColumnType: ClickHouseDataType(columnType),
	}
}

type JsonToClickHouseMapper struct {
	Streams map[string]Stream
	Columns []*SinkMapping

	fieldColumnMap map[string]*SinkMapping
	orderedColumns []string
	columnOrderMap map[string]int
}

func convertStreams(streams map[string]models.StreamSchemaConfig) map[string]Stream {
	mappedStreams := make(map[string]Stream)

	for streamName, streamConfig := range streams {
		fields := make(map[string]KafkaDataType)

		for _, field := range streamConfig.Fields {
			fields[field.FieldName] = KafkaDataType(field.FieldType)
		}

		mappedStreams[streamName] = Stream{
			Fields:          fields,
			JoinKey:         streamConfig.JoinKeyField,
			JoinOrientation: streamConfig.JoinOrientation,
			JoinWindow:      streamConfig.JoinWindow.Duration(),
		}
	}

	return mappedStreams
}

func NewJSONToClickHouseMapper(streamsConfig map[string]models.StreamSchemaConfig, sinkMappingConfig []models.SinkMappingConfig) (*JsonToClickHouseMapper, error) {
	columnMappings := make([]*SinkMapping, 0, len(sinkMappingConfig))
	for _, mapping := range sinkMappingConfig {
		columnMappings = append(columnMappings, NewSinkMapping(mapping.ColumnName, mapping.StreamName, mapping.FieldName, mapping.ColumnType))
	}

	m := &JsonToClickHouseMapper{ //nolint:exhaustruct //missed fields will be added
		Streams:        make(map[string]Stream),
		Columns:        columnMappings,
		fieldColumnMap: make(map[string]*SinkMapping),
		columnOrderMap: make(map[string]int),
	}

	m.Streams = convertStreams(streamsConfig)

	if err := m.validate(); err != nil {
		return nil, err
	}

	for _, column := range m.Columns {
		m.fieldColumnMap[column.FieldName] = column
	}

	m.buildColumnOrder()

	return m, nil
}

func (m *JsonToClickHouseMapper) validate() error {
	if len(m.Streams) == 0 {
		return fmt.Errorf("no streams defined in mapping")
	}

	for streamName, stream := range m.Streams {
		if len(stream.Fields) == 0 {
			return fmt.Errorf("no fields defined in stream '%s'", streamName)
		}

		if stream.JoinKey != "" {
			if _, ok := stream.Fields[stream.JoinKey]; !ok {
				return fmt.Errorf("join key '%s' not found in stream '%s'", stream.JoinKey, streamName)
			}
		}
	}

	if len(m.Columns) == 0 {
		return fmt.Errorf("no columns defined in mapping")
	}

	for _, column := range m.Columns {
		streamSchema, ok := m.Streams[column.StreamName]
		if !ok {
			return fmt.Errorf("stream '%s' not found in configuration", column.StreamName)
		}

		if _, ok := streamSchema.Fields[column.FieldName]; !ok {
			return fmt.Errorf("field '%s' not found in stream '%s'", column.FieldName, column.StreamName)
		}
	}

	return nil
}

func (m *JsonToClickHouseMapper) buildColumnOrder() {
	m.orderedColumns = make([]string, len(m.Columns))

	for i, column := range m.Columns {
		m.orderedColumns[i] = column.ColumnName
		m.columnOrderMap[column.ColumnName] = i
	}
}

func (m *JsonToClickHouseMapper) getKey(streamSchemaName, keyName string, data []byte) (any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	// Use getNestedValue to support nested JSON fields with dot notation
	value, exists := getNestedValue(jsonData, keyName)
	if !exists {
		return nil, fmt.Errorf("key %s not found in data", keyName)
	}

	fieldType := m.Streams[streamSchemaName].Fields[keyName]

	convertedValue, err := ExtractEventValue(fieldType, value)
	if err != nil {
		return nil, fmt.Errorf("failed to convert key value: %w", err)
	}

	return convertedValue, nil
}

func (m *JsonToClickHouseMapper) GetJoinKey(streamSchemaName string, data []byte) (any, error) {
	keyField := m.Streams[streamSchemaName].JoinKey
	if keyField == "" {
		return nil, fmt.Errorf("no join key defined in schema")
	}

	return m.getKey(streamSchemaName, keyField, data)
}

func (m *JsonToClickHouseMapper) GetKey(streamSchemaName, keyName string, data []byte) (any, error) {
	if keyName == "" {
		return nil, fmt.Errorf("key name cannot be empty")
	}

	if _, exists := m.Streams[streamSchemaName]; !exists {
		return nil, fmt.Errorf("stream '%s' not found in configuration", streamSchemaName)
	}

	if _, exists := m.Streams[streamSchemaName].Fields[keyName]; !exists {
		return nil, fmt.Errorf("key '%s' not found in stream '%s'", keyName, streamSchemaName)
	}

	return m.getKey(streamSchemaName, keyName, data)
}

func (m *JsonToClickHouseMapper) prepareForClickHouse(data []byte) (map[string]any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	result := make(map[string]any)

	for _, column := range m.Columns {
		fieldName := column.FieldName
		if len(m.Streams) > 1 {
			fieldName = column.StreamName + "." + fieldName
		}

		value, exists := getNestedValue(jsonData, fieldName)
		if !exists {
			continue
		}

		fieldType := m.Streams[column.StreamName].Fields[column.FieldName]

		convertedValue, err := ConvertValue(column.ColumnType, fieldType, value)
		if err != nil {
			return nil, fmt.Errorf("failed to convert field %s: %w", column.FieldName, err)
		}

		result[column.ColumnName] = convertedValue
	}

	return result, nil
}

func (m *JsonToClickHouseMapper) getMappedValues(data map[string]any) []any {
	values := make([]any, len(m.orderedColumns))

	for colName, value := range data {
		if idx, ok := m.columnOrderMap[colName]; ok {
			values[idx] = value
		}
	}

	return values
}

func (m *JsonToClickHouseMapper) GetOrderedColumns() []string {
	return m.orderedColumns
}

func (m *JsonToClickHouseMapper) PrepareValues(data []byte) ([]any, error) {
	mappedData, err := m.prepareForClickHouse(data)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare values for ClickHouse: %w", err)
	}

	values := m.getMappedValues(mappedData)

	return values, nil
}

func (m *JsonToClickHouseMapper) GetFieldsMap(streamSchemaName string, data []byte) (map[string]any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	resultedMap := make(map[string]any)

	for fieldName := range m.Streams[streamSchemaName].Fields {
		if value, exists := getNestedValue(jsonData, fieldName); exists {
			resultedMap[fieldName] = value
		}
	}

	return resultedMap, nil
}

func (m *JsonToClickHouseMapper) ValidateSchema(streamSchemaName string, data []byte) error {
	if _, exists := m.Streams[streamSchemaName]; !exists {
		return fmt.Errorf("stream '%s' not found in configuration", streamSchemaName)
	}

	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return fmt.Errorf("failed to parse JSON data: %w", err)
	}

	for key := range m.Streams[streamSchemaName].Fields {
		if _, exists := getNestedValue(jsonData, key); !exists {
			return fmt.Errorf("field '%s' not found in data for stream '%s'", key, streamSchemaName)
		}
	}

	return nil
}

func (m *JsonToClickHouseMapper) JoinData(leftStreamName string, leftData []byte, rightStreamName string, rightData []byte) ([]byte, error) {
	if leftData == nil || rightData == nil {
		return nil, fmt.Errorf("left or right data is nil")
	}

	var result map[string]any
	var leftMap map[string]any
	var rightMap map[string]any

	leftMap, err := m.GetFieldsMap(leftStreamName, leftData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal left data: %w", err)
	}

	rightMap, err = m.GetFieldsMap(rightStreamName, rightData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal right data: %w", err)
	}

	result = make(map[string]any)
	for key, value := range leftMap {
		result[leftStreamName+"."+key] = value
	}

	for key, value := range rightMap {
		result[rightStreamName+"."+key] = value
	}

	resultData, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result data: %w", err)
	}

	return resultData, nil
}

// getNestedValue extracts a value from a nested JSON object using dot notation
// Only supports direct field access, not array indexing.
func getNestedValue(data map[string]any, path string) (any, bool) {
	if data == nil || path == "" {
		return nil, false
	}

	// First, try to find the path as a flat key (for join operators with . separator)
	if value, exists := data[path]; exists {
		return value, true
	}

	parts := strings.Split(path, ".")
	current := any(data)

	for _, part := range parts {
		if current == nil {
			return nil, false
		}

		mapValue, ok := current.(map[string]any)
		if !ok {
			return nil, false
		}
		current, ok = mapValue[part]
		if !ok {
			return nil, false
		}
	}

	return current, true
}
