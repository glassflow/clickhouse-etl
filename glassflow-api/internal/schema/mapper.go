package schema

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Mapper interface {
	GetLeftStreamTTL() (time.Duration, error)
	GetRightStreamTTL() (time.Duration, error)
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
	if cfg.Type != internal.SchemaMapperJSONToCHType {
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

	leftStream  string
	rightStream string
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

	for name, stream := range m.Streams {
		switch stream.JoinOrientation {
		case "left":
			m.leftStream = name
		case "right":
			m.rightStream = name
		}
	}

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
			// For join keys, we need to check the base field name if it contains array indexing
			baseJoinKey := stream.JoinKey
			if strings.Contains(baseJoinKey, "[") {
				baseJoinKey = strings.Split(baseJoinKey, "[")[0]
			}

			if _, ok := stream.Fields[baseJoinKey]; !ok {
				return fmt.Errorf("join key '%s' not found in stream '%s'", baseJoinKey, streamName)
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

		// For array indexing, we need to check the base field name
		baseFieldName := column.FieldName
		if strings.Contains(baseFieldName, "[") {
			// Extract the base field name before the array index
			baseFieldName = strings.Split(baseFieldName, "[")[0]
		}

		// For nested fields, we need to check if the base path exists
		// This is a simplified check - in a real implementation, you might want to
		// validate the entire nested path structure
		if strings.Contains(baseFieldName, ".") {
			// For nested fields with array indexing, we'll skip validation for now
			// as the full nested path validation would be complex
			// The actual validation will happen at runtime when processing the data
		} else {
			if _, ok := streamSchema.Fields[baseFieldName]; !ok {
				return fmt.Errorf("field '%s' not found in stream '%s'", baseFieldName, column.StreamName)
			}
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

func (m *JsonToClickHouseMapper) GetLeftStreamTTL() (time.Duration, error) {
	if m.leftStream == "" {
		return 0, fmt.Errorf("left stream is not defined in the mapper")
	}
	return m.Streams[m.leftStream].JoinWindow, nil
}

func (m *JsonToClickHouseMapper) GetRightStreamTTL() (time.Duration, error) {
	if m.rightStream == "" {
		return 0, fmt.Errorf("right stream is not defined in the mapper")
	}
	return m.Streams[m.rightStream].JoinWindow, nil
}

func (m *JsonToClickHouseMapper) GetLeftStream() string {
	return m.leftStream
}

func (m *JsonToClickHouseMapper) GetRightStream() string {
	return m.rightStream
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
			// Check if this is an array index access that failed
			if strings.Contains(fieldName, "[") {
				return nil, fmt.Errorf("array index out of bounds or invalid path for field: %s", fieldName)
			}
			continue
		}

		// For array indexing, we need to determine the field type differently
		// If the original field name contains array indexing, we need to get the base field type
		baseFieldName := column.FieldName
		if strings.Contains(baseFieldName, "[") {
			// Extract the base field name before the array index
			baseFieldName = strings.Split(baseFieldName, "[")[0]
		}

		fieldType := m.Streams[column.StreamName].Fields[baseFieldName]

		// If we're extracting an array element, we need to determine the element type
		// For now, we'll assume string type for array elements, but this could be enhanced
		// to support different array element types in the future
		if strings.Contains(column.FieldName, "[") {
			// For array elements, we'll use string type as the default
			// This could be enhanced to support different array element types
			fieldType = internal.KafkaTypeString
		}

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

// PathPart represents a part of a JSON path, supporting both object keys and array indices
type PathPart struct {
	Name         string
	Index        int
	IsArrayIndex bool
}

// getNestedValue extracts a value from a nested JSON object using dot notation and array indexing
// Supports paths like "user.name", "tags[0]", "user.addresses[1]", etc.
func getNestedValue(data map[string]any, path string) (any, bool) {
	if data == nil || path == "" {
		return nil, false
	}

	// First, try to find the path as a flat key (for join operators with . separator)
	if value, exists := data[path]; exists {
		return value, true
	}

	// Parse the path to handle both dot notation and array indexing
	parts := parsePathWithArrayIndex(path)
	if parts == nil {
		return nil, false
	}

	return getNestedValueWithArrayIndex(data, parts)
}

// parsePathWithArrayIndex parses a JSON path string into PathPart components
// Supports paths like "user.name", "tags[0]", "user.addresses[1]", etc.
func parsePathWithArrayIndex(path string) []PathPart {
	var parts []PathPart
	var current strings.Builder
	i := 0

	for i < len(path) {
		char := path[i]

		if char == '.' {
			// End of current part
			if current.Len() > 0 {
				parts = append(parts, PathPart{Name: current.String()})
				current.Reset()
			}
		} else if char == '[' {
			// Start of array index
			if current.Len() > 0 {
				parts = append(parts, PathPart{Name: current.String()})
				current.Reset()
			}

			// Find the closing bracket
			i++
			var indexStr strings.Builder
			for i < len(path) && path[i] != ']' {
				indexStr.WriteByte(path[i])
				i++
			}

			if i >= len(path) || path[i] != ']' {
				// Invalid syntax - missing closing bracket
				return nil
			}

			index, err := strconv.Atoi(indexStr.String())
			if err != nil {
				// Invalid index - not a number
				return nil
			}

			parts = append(parts, PathPart{Index: index, IsArrayIndex: true})
		} else {
			current.WriteByte(char)
		}
		i++
	}

	// Add the last part if any
	if current.Len() > 0 {
		parts = append(parts, PathPart{Name: current.String()})
	}

	return parts
}

// getNestedValueWithArrayIndex navigates through the JSON structure using parsed path parts
func getNestedValueWithArrayIndex(data map[string]any, parts []PathPart) (any, bool) {
	current := any(data)

	for _, part := range parts {
		if current == nil {
			return nil, false
		}

		if part.IsArrayIndex {
			// Handle array access
			arrayValue, ok := current.([]any)
			if !ok {
				return nil, false
			}
			if part.Index < 0 || part.Index >= len(arrayValue) {
				return nil, false
			}
			current = arrayValue[part.Index]
		} else {
			// Handle object access
			mapValue, ok := current.(map[string]any)
			if !ok {
				return nil, false
			}
			current, ok = mapValue[part.Name]
			if !ok {
				return nil, false
			}
		}
	}

	return current, true
}
