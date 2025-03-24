package schema

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// DataType represents supported data types
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

// ClickHouseColumn defines mapping between a JSON field and a ClickHouse column
type ClickHouseColumn struct {
	ColumnName string `json:"column_name"`
	FieldName  string `json:"field_name"`
	ColumnType string `json:"column_type"`
}

// SchemaConfig represents the JSON schema configuration
type SchemaConfig struct {
	Fields     map[string]DataType `json:"fields"` // Map of field names to their types
	PrimaryKey string              `json:"primary_key"`
	Columns    []ClickHouseColumn  `json:"clickhouse_mapping"` // Mappings between fields and CH columns
}

// SchemaMapper holds the schema information and mapping to ClickHouse
type SchemaMapper struct {
	Fields         map[string]DataType
	PrimaryKey     string
	Columns        []ClickHouseColumn
	fieldColumnMap map[string]ClickHouseColumn // Field name to column mapping for quick lookup
	typeConverters map[DataType]func(any) (any, error)
	columnOrderMap map[string]int // For maintaining column order in batches
	orderedColumns []string       // Ordered list of ClickHouse column names
}

// NewSchemaMapper creates a schema mapper from JSON configuration
func NewSchemaMapper(config SchemaConfig) (*SchemaMapper, error) {
	schema := &SchemaMapper{
		Fields:         config.Fields,
		PrimaryKey:     config.PrimaryKey,
		Columns:        config.Columns,
		fieldColumnMap: make(map[string]ClickHouseColumn),
		columnOrderMap: make(map[string]int),
	}

	// Validate schema
	if err := schema.validate(); err != nil {
		return nil, err
	}

	// Initialize field-to-column mapping
	for _, column := range schema.Columns {
		schema.fieldColumnMap[column.FieldName] = column
	}

	// Build column order for consistent results
	schema.buildColumnOrder()

	// Initialize type converters
	schema.initTypeConverters()

	return schema, nil
}

// validate checks if the schema is valid
func (s *SchemaMapper) validate() error {
	// Check if primary key exists in fields (if specified)
	if s.PrimaryKey != "" {
		if _, ok := s.Fields[s.PrimaryKey]; !ok {
			return fmt.Errorf("primary key '%s' not found in fields", s.PrimaryKey)
		}
	}

	// Check if all column fields exist in the fields map
	for _, column := range s.Columns {
		if _, ok := s.Fields[column.FieldName]; !ok {
			return fmt.Errorf("field '%s' referenced in column mapping does not exist in schema", column.FieldName)
		}
	}

	return nil
}

// buildColumnOrder creates a deterministic order for columns
func (s *SchemaMapper) buildColumnOrder() {
	s.orderedColumns = make([]string, len(s.Columns))

	for i, column := range s.Columns {
		s.orderedColumns[i] = column.ColumnName
		s.columnOrderMap[column.ColumnName] = i
	}
}

// initTypeConverters initializes type conversion functions
func (s *SchemaMapper) initTypeConverters() {
	s.typeConverters = make(map[DataType]func(any) (any, error))

	s.typeConverters[TypeString] = func(v any) (any, error) {
		switch val := v.(type) {
		case []byte:
			return string(val), nil
		default:
			return fmt.Sprintf("%v", val), nil
		}
	}

	s.typeConverters[TypeInt] = func(v any) (any, error) {
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

	s.typeConverters[TypeFloat] = func(v any) (any, error) {
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

	s.typeConverters[TypeBool] = func(v any) (any, error) {
		switch val := v.(type) {
		case bool:
			return val, nil
		case string:
			return strconv.ParseBool(val)
		case []byte:
			return strconv.ParseBool(string(val))
		case int, int64, float64:
			n := reflect.ValueOf(val).Float()
			return n != 0, nil
		default:
			return nil, fmt.Errorf("cannot convert %v to bool", val)
		}
	}

	s.typeConverters[TypeBytes] = func(v any) (any, error) {
		switch val := v.(type) {
		case string:
			return base64.StdEncoding.DecodeString(val)
		case []byte:
			return val, nil
		default:
			return nil, fmt.Errorf("cannot convert %v to bytes", val)
		}
	}

	s.typeConverters[TypeUUID] = func(v any) (any, error) {
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
			// Try to convert to string first
			str := fmt.Sprintf("%v", val)
			return s.typeConverters[TypeUUID](str)
		}
	}

	s.typeConverters[TypeArray] = func(v any) (any, error) {
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

	s.typeConverters[TypeDateTime] = func(v any) (any, error) {
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
			// Try to convert to string first
			str := fmt.Sprintf("%v", val)
			return parseDateTime(str)
		}
	}
}

// parseDateTime attempts to parse a string as a datetime using various formats
func parseDateTime(value string) (time.Time, error) {
	// List of formats to try, from most specific to least specific
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04:05.999",
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

	// Try Unix timestamp (seconds since epoch)
	if i, err := strconv.ParseInt(value, 10, 64); err == nil {
		// If it's reasonably within Unix timestamp range (1970-2100)
		if i > 0 && i < 4102444800 {
			return time.Unix(i, 0), nil
		}
	}

	// Try each format
	for _, layout := range formats {
		if t, err := time.Parse(layout, value); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse datetime from '%s'", value)
}

// GetPrimaryKey extracts the primary key value from JSON data
func (s *SchemaMapper) GetPrimaryKey(data []byte) (any, error) {
	if s.PrimaryKey == "" {
		return nil, fmt.Errorf("no primary key defined in schema")
	}

	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	pkValue, exists := jsonData[s.PrimaryKey]
	if !exists {
		return nil, fmt.Errorf("primary key %s not found in data", s.PrimaryKey)
	}

	// Get the field type for the primary key
	fieldType := s.Fields[s.PrimaryKey]

	// Convert the value to the proper type
	converter, exists := s.typeConverters[fieldType]
	if !exists {
		return nil, fmt.Errorf("unsupported type %s for field %s", fieldType, s.PrimaryKey)
	}

	convertedValue, err := converter(pkValue)
	if err != nil {
		return nil, fmt.Errorf("failed to convert primary key value: %w", err)
	}

	return convertedValue, nil
}

// PrepareForClickHouse transforms JSON data to ClickHouse-ready format
func (s *SchemaMapper) PrepareForClickHouse(data []byte) (map[string]any, error) {
	var jsonData map[string]any
	if err := json.Unmarshal(data, &jsonData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON data: %w", err)
	}

	result := make(map[string]any)

	// Process each column mapping
	for _, column := range s.Columns {
		value, exists := jsonData[column.FieldName]
		if !exists {
			// Field is missing in input data
			continue
		}

		fieldType := s.Fields[column.FieldName]

		// Convert to the appropriate type
		converter, exists := s.typeConverters[fieldType]
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

// GetOrderedColumns returns the ordered list of ClickHouse column names
func (s *SchemaMapper) GetOrderedColumns() []string {
	return s.orderedColumns
}

// PrepareClickHouseValues converts raw JSON data to an array of values in the correct column order
func (s *SchemaMapper) PrepareClickHouseValues(data []byte) ([]any, error) {
	// First convert JSON data to mapped values
	mappedData, err := s.PrepareForClickHouse(data)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare values for ClickHouse: %w", err)
	}

	// Create array with length matching our columns
	values := make([]any, len(s.orderedColumns))

	// Place values in the correct order based on column mapping
	for colName, value := range mappedData {
		if idx, ok := s.columnOrderMap[colName]; ok {
			values[idx] = value
		}
	}

	return values, nil
}

// GetMappedValues converts data map to an array of values in the correct column
func (s *SchemaMapper) GetMappedValues(data map[string]any) []any {
	values := make([]any, len(s.orderedColumns))

	for colName, value := range data {
		if idx, ok := s.columnOrderMap[colName]; ok {
			values[idx] = value
		}
	}

	return values
}
