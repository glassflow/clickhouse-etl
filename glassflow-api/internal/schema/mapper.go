package schema

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/tidwall/gjson"
)

type Mapper interface {
	GetLeftStreamTTL() (time.Duration, error)
	GetRightStreamTTL() (time.Duration, error)
	GetJoinKey(streamSchemaName string, data []byte) (any, error)
	GetKey(streamSchemaName, keyName string, data []byte) (any, error)
	GetOrderedColumns() []string
	GetOrderedColumnsStream(streamSchemaName string) []string
	PrepareValues(data []byte) ([]any, error)
	PrepareValuesStream(streamSchemaName string, data []byte) ([]any, error)
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

// columnLookupInfo holds pre-computed column information for fast lookup
type columnLookupInfo struct {
	index     int
	column    *SinkMapping
	fieldType KafkaDataType
}

type JsonToClickHouseMapper struct {
	Streams map[string]Stream
	Columns []*SinkMapping

	fieldColumnMap         map[string]*SinkMapping
	orderedColumns         []string
	columnOrderMap         map[string]int
	columnLookUpInfo       map[string]columnLookupInfo
	columnLookUpInfoStream map[string]map[string]columnLookupInfo // streamName -> fieldName -> info

	leftStream  string
	rightStream string
}

func (m *JsonToClickHouseMapper) GetOrderedColumnsStream(streamSchemaName string) []string {
	var columns []string
	for _, column := range m.Columns {
		if column.StreamName == streamSchemaName {
			columns = append(columns, column.ColumnName)
		}
	}
	return columns
}

func (m *JsonToClickHouseMapper) PrepareValuesStream(streamSchemaName string, data []byte) ([]any, error) {
	// Get stream-specific lookup map
	streamLookup, streamExists := m.columnLookUpInfoStream[streamSchemaName]
	if !streamExists {
		// Return empty slice if stream not found
		return []any{}, nil
	}

	parsed := gjson.ParseBytes(data)

	// Count columns for this stream to size the values slice
	columnCount := 0
	for _, column := range m.Columns {
		if column.StreamName == streamSchemaName {
			columnCount++
		}
	}

	values := make([]any, columnCount)

	// First, iterate through top-level keys to handle flat keys (including those with dots)
	var conversionErr error
	parsed.ForEach(func(key, value gjson.Result) bool {
		info, exists := streamLookup[key.String()]
		if exists {
			convertedValue, err := ConvertValueFromGjson(info.column.ColumnType, info.fieldType, value)
			if err != nil {
				conversionErr = fmt.Errorf("failed to convert field %s: %w", info.column.FieldName, err)
				return false // stop iteration on error
			}
			values[info.index] = convertedValue
		}
		return true // continue iteration
	})

	if conversionErr != nil {
		return nil, conversionErr
	}

	// Then, for any remaining fields not found as top-level keys, try nested path lookup
	for fieldName, info := range streamLookup {
		if values[info.index] != nil {
			continue
		}

		value := parsed.Get(fieldName)
		if value.Exists() {
			convertedValue, err := ConvertValueFromGjson(info.column.ColumnType, info.fieldType, value)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field %s: %w", info.column.FieldName, err)
			}
			values[info.index] = convertedValue
		}
	}

	return values, nil
}

func convertStreams(streams map[string]models.StreamSchemaConfig) map[string]Stream {
	mappedStreams := make(map[string]Stream)

	for streamName, streamConfig := range streams {
		fields := make(map[string]KafkaDataType)

		for _, field := range streamConfig.Fields {
			fields[field.FieldName] = KafkaDataType(internal.NormalizeToBasicKafkaType(field.FieldType))
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
		Streams:                make(map[string]Stream),
		Columns:                columnMappings,
		fieldColumnMap:         make(map[string]*SinkMapping),
		columnOrderMap:         make(map[string]int),
		columnLookUpInfo:       make(map[string]columnLookupInfo, len(columnMappings)),
		columnLookUpInfoStream: make(map[string]map[string]columnLookupInfo),
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
	m.buildGjsonFieldLookup()
	m.buildGjsonFieldLookupStream()

	return m, nil
}

// buildGjsonFieldLookup pre-computes the field lookup map for PrepareValuesGjsonForEach
func (m *JsonToClickHouseMapper) buildGjsonFieldLookup() {
	multiStream := len(m.Streams) > 1

	for i, column := range m.Columns {
		var fieldName string
		if multiStream {
			fieldName = column.StreamName + "." + column.FieldName
		} else {
			fieldName = column.FieldName
		}
		m.columnLookUpInfo[fieldName] = columnLookupInfo{
			index:     i,
			column:    column,
			fieldType: m.Streams[column.StreamName].Fields[column.FieldName],
		}
	}
}

// buildGjsonFieldLookupStream pre-computes stream-specific field lookup maps for PrepareValuesStream
func (m *JsonToClickHouseMapper) buildGjsonFieldLookupStream() {
	// Build lookup map for each stream
	for streamName := range m.Streams {
		streamLookup := make(map[string]columnLookupInfo)

		// Find the index of the first column for this stream to calculate relative indices
		streamColumnIndex := 0
		for _, column := range m.Columns {
			if column.StreamName == streamName {
				streamLookup[column.FieldName] = columnLookupInfo{
					index:     streamColumnIndex,
					column:    column,
					fieldType: m.Streams[column.StreamName].Fields[column.FieldName],
				}
				streamColumnIndex++
			}
		}

		if len(streamLookup) > 0 {
			m.columnLookUpInfoStream[streamName] = streamLookup
		}
	}
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

func (m *JsonToClickHouseMapper) GetOrderedColumns() []string {
	return m.orderedColumns
}

// PrepareValues uses gjson to extract values, supporting both flat keys (including those with dots) and nested paths.
func (m *JsonToClickHouseMapper) PrepareValues(data []byte) ([]any, error) {
	parsed := gjson.ParseBytes(data)

	values := make([]any, len(m.Columns))

	// First, iterate through top-level keys to handle flat keys
	var conversionErr error
	parsed.ForEach(func(key, value gjson.Result) bool {
		info, exists := m.columnLookUpInfo[key.String()]
		if exists {
			convertedValue, err := ConvertValueFromGjson(info.column.ColumnType, info.fieldType, value)
			if err != nil {
				conversionErr = fmt.Errorf("failed to convert field %s: %w", info.column.FieldName, err)
				return false // stop iteration on error
			}
			values[info.index] = convertedValue
		}
		return true // continue iteration
	})

	if conversionErr != nil {
		return nil, conversionErr
	}

	// for any remaining fields not found as top-level keys, try nested path lookup
	for fieldPath, info := range m.columnLookUpInfo {
		if values[info.index] != nil {
			continue
		}

		value := parsed.Get(fieldPath)
		if value.Exists() {
			convertedValue, err := ConvertValueFromGjson(info.column.ColumnType, info.fieldType, value)
			if err != nil {
				return nil, fmt.Errorf("failed to convert field %s: %w", info.column.FieldName, err)
			}
			values[info.index] = convertedValue
		}
	}

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
		return nil
	}

	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return fmt.Errorf("failed to parse JSON data: %w", err)
	}

	// Get all field names and sort them for deterministic validation order
	fieldNames := make([]string, 0, len(m.Streams[streamSchemaName].Fields))
	for fieldName := range m.Streams[streamSchemaName].Fields {
		fieldNames = append(fieldNames, fieldName)
	}
	sort.Strings(fieldNames)

	// Check fields in sorted order
	for _, key := range fieldNames {
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
