package schema

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

// parseColumnType pre-parses a ClickHouse column type to cache type information
// This is a helper function used by both mapper and types packages
func parseColumnType(columnType ClickHouseDataType) *ParsedColumnType {
	parsed := &ParsedColumnType{
		FullType: columnType,
		BaseType: columnType,
	}

	typeStr := string(columnType)

	// Check for DateTime types
	if strings.HasPrefix(typeStr, "DateTime") {
		parsed.IsDateTime = true
		// Extract base type (DateTime, DateTime64, etc.)
		if idx := strings.Index(typeStr, "("); idx > 0 {
			parsed.BaseType = ClickHouseDataType(typeStr[:idx])
		}
		return parsed
	}

	// Check for Array types
	if strings.HasPrefix(typeStr, "Array(") {
		parsed.IsArray = true
		if strings.Contains(typeStr, "Map(") {
			parsed.IsArrayOfMap = true
		}
		return parsed
	}

	// Check for Map types
	if strings.HasPrefix(typeStr, "Map(") {
		parsed.IsMap = true
		return parsed
	}

	return parsed
}

type (
	KafkaDataType      string
	ClickHouseDataType string
)

// ParsedColumnType caches parsed information about a ClickHouse column type
// to avoid repeated string operations during conversion
type ParsedColumnType struct {
	BaseType     ClickHouseDataType // The base type (e.g., "Int64", "String")
	IsDateTime   bool               // True if type is DateTime or DateTime64
	IsMap        bool               // True if type is Map(...)
	IsArray      bool               // True if type is Array(...)
	IsArrayOfMap bool               // True if type is Array(Map(...))
	FullType     ClickHouseDataType // The full original type string
}

var (
	ErrUnknownFieldType = errors.New("unknown field type")
)

func ExtractEventValue(dataType KafkaDataType, data any) (zero any, _ error) {
	switch dataType {
	case internal.KafkaTypeString:
		return ParseString(data)
	case internal.KafkaTypeBytes:
		return ParseBytes(data)
	case internal.KafkaTypeBool:
		return ParseBool(data)
	case internal.KafkaTypeInt:
		return ParseInt64(data)
	case internal.KafkaTypeInt8:
		return ParseInt8(data)
	case internal.KafkaTypeInt16:
		return ParseInt16(data)
	case internal.KafkaTypeInt32:
		return ParseInt32(data)
	case internal.KafkaTypeInt64:
		return ParseInt64(data)
	case internal.KafkaTypeUint:
		return ParseUint64(data)
	case internal.KafkaTypeUint8:
		return ParseUint8(data)
	case internal.KafkaTypeUint16:
		return ParseUint16(data)
	case internal.KafkaTypeUint32:
		return ParseUint32(data)
	case internal.KafkaTypeUint64:
		return ParseUint64(data)
	case internal.KafkaTypeFloat:
		return ParseFloat64(data)
	case internal.KafkaTypeFloat32:
		return ParseFloat32(data)
	case internal.KafkaTypeFloat64:
		return ParseFloat64(data)
	case internal.KafkaTypeArray:
		// For arrays, we return the array as-is since it's already in the correct format
		// The actual processing will be done by the ConvertValue function
		return data, nil
	case internal.KafkaTypeMap:
		// For maps, we return the map as-is since it's already in the correct format
		// The actual processing will be done by the ConvertValue function
		return data, nil
	default:
		return zero, fmt.Errorf("%w: %s", ErrUnknownFieldType, dataType)
	}
}

// ConvertValueWithParsedType is the optimized version that uses pre-parsed type info
// to avoid string operations and double type checking
func ConvertValueWithParsedType(parsedType *ParsedColumnType, columnType ClickHouseDataType, fieldType KafkaDataType, data any) (zero any, _ error) {
	// If data is nil, pass it through to let ClickHouse handle null validation
	// HOTFIX: This is a temporary, will be moved up and sent to DLQ as a proper solution.
	if data == nil {
		return nil, nil
	}

	// Use pre-parsed type info to avoid string operations
	if parsedType != nil {
		if parsedType.IsDateTime {
			return convertDateTimeValue(fieldType, data)
		}
		if parsedType.IsArray {
			return convertArrayValue(parsedType, fieldType, data)
		}
		if parsedType.IsMap {
			return convertMapValue(fieldType, data)
		}
		// Use base type for switch
		columnType = parsedType.BaseType
	}

	// Optimized conversion: combine type validation and extraction to avoid double checking
	switch columnType {
	case internal.CHTypeBool:
		if fieldType != internal.KafkaTypeBool {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", internal.KafkaTypeBool, fieldType)
		}
		// Optimized: direct parse instead of ExtractEventValue to avoid double switch
		return ParseBool(data)
	case internal.CHTypeInt8, internal.CHTypeLCInt8:
		if fieldType == internal.KafkaTypeInt8 || fieldType == internal.KafkaTypeInt {
			return ParseInt8(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt8, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt16, internal.CHTypeLCInt16:
		if fieldType == internal.KafkaTypeInt16 || fieldType == internal.KafkaTypeInt {
			return ParseInt16(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt16, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt32, internal.CHTypeLCInt32:
		if fieldType == internal.KafkaTypeInt32 || fieldType == internal.KafkaTypeInt {
			return ParseInt32(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt32, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt64, internal.CHTypeLCInt64:
		if fieldType == internal.KafkaTypeInt64 || fieldType == internal.KafkaTypeInt {
			return ParseInt64(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt64, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeUInt8, internal.CHTypeLCUInt8:
		if fieldType == internal.KafkaTypeUint8 || fieldType == internal.KafkaTypeUint {
			return ParseUint8(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint8, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt16, internal.CHTypeLCUInt16:
		if fieldType == internal.KafkaTypeUint16 || fieldType == internal.KafkaTypeUint {
			return ParseUint16(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint16, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt32, internal.CHTypeLCUInt32:
		if fieldType == internal.KafkaTypeUint32 || fieldType == internal.KafkaTypeUint {
			return ParseUint32(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint32, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt64, internal.CHTypeLCUInt64:
		if fieldType == internal.KafkaTypeUint64 || fieldType == internal.KafkaTypeUint {
			return ParseUint64(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint64, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeFloat32, internal.CHTypeLCFloat32:
		if fieldType == internal.KafkaTypeFloat32 || fieldType == internal.KafkaTypeFloat {
			return ParseFloat32(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeFloat32, internal.KafkaTypeFloat, fieldType)
	case internal.CHTypeFloat64, internal.CHTypeLCFloat64:
		if fieldType == internal.KafkaTypeFloat64 || fieldType == internal.KafkaTypeFloat {
			return ParseFloat64(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeFloat64, internal.KafkaTypeFloat, fieldType)
	case internal.CHTypeEnum8, internal.CHTypeEnum16, internal.CHTypeUUID, internal.CHTypeFString, internal.CHTypeLCString, internal.CHTypeLCFString:
		if fieldType != internal.KafkaTypeString {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", internal.KafkaTypeString, fieldType)
		}
		return ParseString(data)
	case internal.CHTypeString:
		if fieldType == internal.KafkaTypeString || fieldType == internal.KafkaTypeBytes {
			if fieldType == internal.KafkaTypeBytes {
				return ParseBytes(data)
			}
			return ParseString(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeString, internal.KafkaTypeBytes, fieldType)
	default:
		return zero, fmt.Errorf("unsupported ClickHouse data type: %s", columnType)
	}
}

// convertDateTimeValue handles DateTime conversion (optimized path)
func convertDateTimeValue(fieldType KafkaDataType, data any) (any, error) {
	switch fieldType {
	case internal.KafkaTypeInt, internal.KafkaTypeInt32, internal.KafkaTypeInt64:
		return ParseDateTimeFromInt64(data)
	case internal.KafkaTypeFloat, internal.KafkaTypeFloat32, internal.KafkaTypeFloat64:
		return ParseDateTimeFromFloat64(data)
	case internal.KafkaTypeString:
		return ParseDateTimeFromString(data)
	default:
		return nil, fmt.Errorf("mismatched types: expected int, float or string type for DateTime, got %s", fieldType)
	}
}

// convertArrayValue handles Array conversion (optimized path)
func convertArrayValue(parsedType *ParsedColumnType, fieldType KafkaDataType, data any) (any, error) {
	if parsedType.IsArrayOfMap {
		if mapArrayData, ok := data.([]any); ok {
			return convertMapArrayToStringMapArray(mapArrayData)
		}
		return nil, fmt.Errorf("expected array of maps for Array(Map) type, got %T", data)
	}
	if fieldType == internal.KafkaTypeArray {
		return data, nil
	}
	if arrayData, ok := data.([]any); ok {
		jsonBytes, err := json.Marshal(arrayData)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal array to JSON: %w", err)
		}
		return string(jsonBytes), nil
	}
	return nil, fmt.Errorf("expected array data for Array type, got %T", data)
}

// convertMapValue handles Map conversion (optimized path)
func convertMapValue(fieldType KafkaDataType, data any) (any, error) {
	if fieldType == internal.KafkaTypeMap {
		return convertMapToStringMap(data)
	}
	if mapData, ok := data.(map[string]any); ok {
		return convertMapToStringMap(mapData)
	}
	return nil, fmt.Errorf("expected map data for Map type, got %T", data)
}

// ConvertValue is kept for backward compatibility but delegates to optimized version
func ConvertValue(columnType ClickHouseDataType, fieldType KafkaDataType, data any) (zero any, _ error) {
	parsedType := parseColumnType(columnType)
	return ConvertValueWithParsedType(parsedType, columnType, fieldType, data)
}

func GetDefaultValueForKafkaType(kafkaType KafkaDataType) (any, error) {
	// we would get invalid zeroValue only if there's unknown type
	zeroValue, err := ExtractEventValue(kafkaType, "")
	if err != nil && errors.Is(err, ErrUnknownFieldType) {
		return nil, err
	}

	return zeroValue, nil
}

// convertMapToStringMap converts map[string]any to map[string]string for ClickHouse compatibility
func convertMapToStringMap(data any) (map[string]string, error) {
	if data == nil {
		return nil, nil
	}

	mapData, ok := data.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("expected map[string]any, got %T", data)
	}

	result := make(map[string]string)
	for key, value := range mapData {
		if value == nil {
			result[key] = ""
			continue
		}

		// Convert value to string
		switch v := value.(type) {
		case string:
			result[key] = v
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			result[key] = fmt.Sprintf("%d", v)
		case float32, float64:
			result[key] = fmt.Sprintf("%g", v)
		case bool:
			result[key] = fmt.Sprintf("%t", v)
		default:
			// For complex types, convert to JSON string
			jsonBytes, err := json.Marshal(v)
			if err != nil {
				return nil, fmt.Errorf("failed to marshal value %v to JSON: %w", v, err)
			}
			result[key] = string(jsonBytes)
		}
	}

	return result, nil
}

// convertMapArrayToStringMapArray converts []any containing maps to []map[string]string for ClickHouse compatibility
func convertMapArrayToStringMapArray(data []any) ([]map[string]string, error) {
	if data == nil {
		return nil, nil
	}

	result := make([]map[string]string, 0, len(data))
	for i, item := range data {
		if item == nil {
			result = append(result, nil)
			continue
		}

		mapItem, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("array element at index %d is not a map, got %T", i, item)
		}

		convertedMap, err := convertMapToStringMap(mapItem)
		if err != nil {
			return nil, fmt.Errorf("failed to convert map at index %d: %w", i, err)
		}

		result = append(result, convertedMap)
	}

	return result, nil
}
