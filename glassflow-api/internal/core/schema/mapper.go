package schema

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"time"

	"github.com/google/uuid"
)

type DataType string

const (
	TypeString   DataType = "string"
	TypeInt      DataType = "int"
	TypeFloat    DataType = "float"
	TypeBool     DataType = "bool"
	TypeBytes    DataType = "bytes"
	TypeUUID     DataType = "uuid"
	TypeArray    DataType = "array"
	TypeDateTime DataType = "datetime"
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
	Fields  map[string]DataType
	JoinKey string
}

type Config struct {
	Streams     map[string]StreamSchemaConfig `json:"streams"`
	SinkMapping []SinkMappingConfig           `json:"sink_mapping"`
}

type Mapper struct {
	Streams map[string]Stream
	Columns []SinkMappingConfig

	fieldColumnMap map[string]SinkMappingConfig
	typeConverters map[DataType]func(any) (any, error)
	orderedColumns []string
	columnOrderMap map[string]int
}

func convirtStreams(streams map[string]StreamSchemaConfig) map[string]Stream {
	mappedStreams := make(map[string]Stream)

	for streamName, streamConfig := range streams {
		fields := make(map[string]DataType)

		for _, field := range streamConfig.Fields {
			fields[field.FieldName] = DataType(field.FieldType)
		}

		mappedStreams[streamName] = Stream{
			Fields:  fields,
			JoinKey: streamConfig.JoinKeyField,
		}
	}

	return mappedStreams
}

func NewMapper(streamsConfig map[string]StreamSchemaConfig, sinkMappingConfig []SinkMappingConfig) (*Mapper, error) {
	m := &Mapper{ //nolint:exhaustruct //missed fields will be added
		Streams:        make(map[string]Stream),
		Columns:        sinkMappingConfig,
		fieldColumnMap: make(map[string]SinkMappingConfig),
		columnOrderMap: make(map[string]int),
	}

	m.Streams = convirtStreams(streamsConfig)

	if err := m.validate(); err != nil {
		return nil, err
	}

	for _, column := range m.Columns {
		m.fieldColumnMap[column.FieldName] = column
	}

	m.buildColumnOrder()
	m.initTypeConverters()

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

func (m *Mapper) initTypeConverters() {
	m.typeConverters = make(map[DataType]func(any) (any, error))

	m.typeConverters[TypeString] = func(v any) (any, error) { //nolint:unparam //common func structure
		switch val := v.(type) {
		case []byte:
			return string(val), nil
		default:
			return fmt.Sprintf("%v", val), nil
		}
	}

	m.typeConverters[TypeInt] = func(v any) (any, error) {
		switch val := v.(type) {
		case float64:
			return int64(val), nil
		case int, int64, int32:
			return reflect.ValueOf(val).Int(), nil
		case string:
			return strconv.ParseInt(val, 10, 64)
		case []byte:
			return strconv.ParseInt(string(val), 10, 64)
		default:
			return nil, fmt.Errorf("cannot convert %v to int", val)
		}
	}

	m.typeConverters[TypeFloat] = func(v any) (any, error) {
		switch val := v.(type) {
		case float64:
			return val, nil
		case int, int64, int32:
			return float64(reflect.ValueOf(val).Int()), nil
		case string:
			return strconv.ParseFloat(val, 64)
		case []byte:
			return strconv.ParseFloat(string(val), 64)
		default:
			return nil, fmt.Errorf("cannot convert %v to float", val)
		}
	}

	m.typeConverters[TypeBool] = func(v any) (any, error) {
		switch val := v.(type) {
		case bool:
			return val, nil
		case string:
			return strconv.ParseBool(val)
		case []byte:
			return strconv.ParseBool(string(val))
		case int, int64:
			n := reflect.ValueOf(val).Int()
			return n != 0, nil
		case float64:
			n := reflect.ValueOf(val).Float()
			return n != 0, nil
		default:
			return nil, fmt.Errorf("cannot convert %v to bool", val)
		}
	}

	m.typeConverters[TypeBytes] = func(v any) (any, error) {
		switch val := v.(type) {
		case string:
			return base64.StdEncoding.DecodeString(val)
		case []byte:
			return val, nil
		default:
			return nil, fmt.Errorf("cannot convert %v to bytes", val)
		}
	}

	m.typeConverters[TypeUUID] = func(v any) (any, error) {
		switch val := v.(type) {
		case string:
			u, err := uuid.Parse(val)
			if err != nil {
				return nil, fmt.Errorf("failed to parse UUID: %w", err)
			}
			return u, nil
		case []byte:
			u, err := uuid.FromBytes(val)
			if err != nil {
				return nil, fmt.Errorf("failed to convert binary UUID: %w", err)
			}
			return u, nil
		default:
			str := fmt.Sprintf("%v", val)
			return m.typeConverters[TypeUUID](str)
		}
	}

	m.typeConverters[TypeArray] = func(v any) (any, error) {
		switch val := v.(type) {
		case []any:
			return val, nil
		case string:
			var arr []any
			if err := json.Unmarshal([]byte(val), &arr); err != nil {
				return nil, fmt.Errorf("cannot convert string to array: %w", err)
			}
			return arr, nil
		case []byte:
			var arr []any
			if err := json.Unmarshal(val, &arr); err != nil {
				return nil, fmt.Errorf("cannot convert bytes to array: %w", err)
			}
			return arr, nil
		default:
			return nil, fmt.Errorf("cannot convert %v to array", val)
		}
	}

	m.typeConverters[TypeDateTime] = func(v any) (any, error) {
		switch val := v.(type) {
		case time.Time:
			return val, nil
		case string:
			return parseDateTime(val)
		case int64:
			return time.Unix(val, 0), nil
		case float64:
			sec, dec := math.Modf(val)
			return time.Unix(int64(sec), int64(dec*1e9)), nil
		case []byte:
			return parseDateTime(string(val))
		default:
			str := fmt.Sprintf("%v", val)
			return parseDateTime(str)
		}
	}
}

func parseDateTime(value string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04:05.999",
		"2006-01-02T15:04:05.999999",
		time.RFC1123,
		time.RFC1123Z,
		time.RFC822,
		time.RFC822Z,
		time.RFC850,
		time.ANSIC,
		"2006-01-02",
		"01/02/2006",
		"02/01/2006",
		"02.01.2006",
		"01.02.2006",
		"2006/01/02",
		"Jan 2, 2006",
		"2 Jan 2006",
	}

	for _, layout := range formats {
		if t, err := time.Parse(layout, value); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse datetime from '%s'", value)
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

			converter, exists := m.typeConverters[fieldType]
			if !exists {
				return nil, fmt.Errorf("unsupported type %s for field %s", fieldType, keyName)
			}

			convertedValue, err := converter(rawValue)
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

		converter, exists := m.typeConverters[fieldType]
		if !exists {
			return nil, fmt.Errorf("unsupported type %s for field %s", fieldType, column.FieldName)
		}

		convertedValue, err := converter(value)
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
