package schema

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type StreamDataField struct {
	FieldName string `json:"field_name"`
	FieldType string `json:"field_type"`
}

type StreamSchemaConfig struct {
	Fields       []StreamDataField `json:"fields"`
	JoinKeyField string            `json:"join_key_field"`
}

type SinkMappingConfig struct {
	ColumnName string `json:"column_name"`
	StreamName string `json:"stream_name"`
	FieldName  string `json:"field_name"`
	ColumnType string `json:"column_type"`
}

type Stream struct {
	Fields  map[string]KafkaDataType
	JoinKey string
}

type Config struct {
	Streams     map[string]StreamSchemaConfig `json:"streams"`
	SinkMapping []SinkMappingConfig           `json:"sink_mapping"`
}

type SinkMapping struct {
	ColumnName string
	StreamName string
	FieldName  string
	ColumnType ClickHouseDataType
}

func NewSinkMapping(columnName, streamName, fieldName, columnType string) *SinkMapping {
	return &SinkMapping{
		ColumnName: columnName,
		StreamName: streamName,
		FieldName:  fieldName,
		ColumnType: ClickHouseDataType(columnType),
	}
}

type Mapper struct {
	Streams map[string]Stream
	Columns []*SinkMapping

	fieldColumnMap map[string]*SinkMapping
	orderedColumns []string
	columnOrderMap map[string]int
}

func convertStreams(streams map[string]StreamSchemaConfig) map[string]Stream {
	mappedStreams := make(map[string]Stream)

	for streamName, streamConfig := range streams {
		fields := make(map[string]KafkaDataType)

		for _, field := range streamConfig.Fields {
			fields[field.FieldName] = KafkaDataType(field.FieldType)
		}

		mappedStreams[streamName] = Stream{
			Fields:  fields,
			JoinKey: streamConfig.JoinKeyField,
		}
	}

	return mappedStreams
}

func NewMapper(streamsConfig map[string]StreamSchemaConfig, sinkMappingConfig []SinkMappingConfig) (*Mapper, error) {
	columnMappings := make([]*SinkMapping, 0, len(sinkMappingConfig))
	for _, mapping := range sinkMappingConfig {
		columnMappings = append(columnMappings, NewSinkMapping(mapping.ColumnName, mapping.StreamName, mapping.FieldName, mapping.ColumnType))
	}

	m := &Mapper{ //nolint:exhaustruct //missed fields will be added
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

func (m *Mapper) validate() error {
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

func (m *Mapper) buildColumnOrder() {
	m.orderedColumns = make([]string, len(m.Columns))

	for i, column := range m.Columns {
		m.orderedColumns[i] = column.ColumnName
		m.columnOrderMap[column.ColumnName] = i
	}
}

func (m *Mapper) getKey(streamSchemaName, keyName string, data []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(data))

	if _, err := dec.Token(); err != nil {
		return nil, fmt.Errorf("failed to read JSON token: %w", err)
	}

	for dec.More() {
		key, err := dec.Token()
		if err != nil {
			return nil, fmt.Errorf("failed to read JSON key: %w", err)
		}

		if keyStr, ok := key.(string); ok && keyStr == keyName {
			var rawValue any
			if err := dec.Decode(&rawValue); err != nil {
				return nil, fmt.Errorf("failed to decode value for key %s: %w", keyName, err)
			}

			fieldType := m.Streams[streamSchemaName].Fields[keyName]

			convertedValue, err := ExtractEventValue(fieldType, rawValue)
			if err != nil {
				return nil, fmt.Errorf("failed to convert key value: %w", err)
			}

			return convertedValue, nil
		}

		if _, err := dec.Token(); err != nil {
			return nil, fmt.Errorf("failed to skip value: %w", err)
		}
	}

	return nil, fmt.Errorf("key %s not found in data", keyName)
}

func (m *Mapper) GetJoinKey(streamSchemaName string, data []byte) (any, error) {
	keyField := m.Streams[streamSchemaName].JoinKey
	if keyField == "" {
		return nil, fmt.Errorf("no join key defined in schema")
	}

	return m.getKey(streamSchemaName, keyField, data)
}

func (m *Mapper) prepareForClickHouse(data []byte) (map[string]any, error) {
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
		value, exists := jsonData[fieldName]
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

func (m *Mapper) getMappedValues(data map[string]any) []any {
	values := make([]any, len(m.orderedColumns))

	for colName, value := range data {
		if idx, ok := m.columnOrderMap[colName]; ok {
			values[idx] = value
		}
	}

	return values
}

func (m *Mapper) GetOrderedColumns() []string {
	return m.orderedColumns
}

func (m *Mapper) PrepareClickHouseValues(data []byte) ([]any, error) {
	mappedData, err := m.prepareForClickHouse(data)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare values for ClickHouse: %w", err)
	}

	values := m.getMappedValues(mappedData)

	return values, nil
}

func (m *Mapper) GetFieldsMap(streamSchemaName string, data []byte) (map[string]any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	resultedMap := make(map[string]any)

	for key, value := range jsonData {
		if _, exists := m.Streams[streamSchemaName].Fields[key]; exists {
			resultedMap[key] = value
		}
	}

	return resultedMap, nil
}

func (m *Mapper) JoinData(leftStreamName string, leftData []byte, rightStreamName string, rightData []byte) ([]byte, error) {
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
