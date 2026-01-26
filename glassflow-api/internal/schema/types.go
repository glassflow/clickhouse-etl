package schema

import (
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	json "github.com/goccy/go-json"
	"github.com/valyala/fastjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type (
	KafkaDataType      string
	ClickHouseDataType string
)

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

func ConvertValue(columnType ClickHouseDataType, fieldType KafkaDataType, data any) (zero any, _ error) {
	// If data is nil, pass it through to let ClickHouse handle null validation
	// HOTFIX: This is a temporary, will be moved up and sent to DLQ as a proper solution.
	if data == nil {
		return nil, nil
	}

	switch columnType {
	case internal.CHTypeBool:
		if fieldType != internal.KafkaTypeBool {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", internal.KafkaTypeBool, fieldType)
		}
		return ExtractEventValue(internal.KafkaTypeBool, data)
	case internal.CHTypeInt8, internal.CHTypeLCInt8:
		if fieldType == internal.KafkaTypeInt8 || fieldType == internal.KafkaTypeInt {
			return ExtractEventValue(internal.KafkaTypeInt8, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt8, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt16, internal.CHTypeLCInt16:
		if fieldType == internal.KafkaTypeInt16 || fieldType == internal.KafkaTypeInt {
			return ExtractEventValue(internal.KafkaTypeInt16, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt16, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt32, internal.CHTypeLCInt32:
		if fieldType == internal.KafkaTypeInt32 || fieldType == internal.KafkaTypeInt {
			return ExtractEventValue(internal.KafkaTypeInt32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt32, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeInt64, internal.CHTypeLCInt64:
		if fieldType == internal.KafkaTypeInt64 || fieldType == internal.KafkaTypeInt {
			return ExtractEventValue(internal.KafkaTypeInt64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeInt64, internal.KafkaTypeInt, fieldType)
	case internal.CHTypeUInt8, internal.CHTypeLCUInt8:
		if fieldType == internal.KafkaTypeUint8 || fieldType == internal.KafkaTypeUint {
			return ExtractEventValue(internal.KafkaTypeUint8, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint8, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt16, internal.CHTypeLCUInt16:
		if fieldType == internal.KafkaTypeUint16 || fieldType == internal.KafkaTypeUint {
			return ExtractEventValue(internal.KafkaTypeUint16, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint16, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt32, internal.CHTypeLCUInt32:
		if fieldType == internal.KafkaTypeUint32 || fieldType == internal.KafkaTypeUint {
			return ExtractEventValue(internal.KafkaTypeUint32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint32, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeUInt64, internal.CHTypeLCUInt64:
		if fieldType == internal.KafkaTypeUint64 || fieldType == internal.KafkaTypeUint {
			return ExtractEventValue(internal.KafkaTypeUint64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeUint64, internal.KafkaTypeUint, fieldType)
	case internal.CHTypeFloat32, internal.CHTypeLCFloat32:
		if fieldType == internal.KafkaTypeFloat32 || fieldType == internal.KafkaTypeFloat {
			return ExtractEventValue(internal.KafkaTypeFloat32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeFloat32, internal.KafkaTypeFloat, fieldType)
	case internal.CHTypeFloat64, internal.CHTypeLCFloat64:
		if fieldType == internal.KafkaTypeFloat64 || fieldType == internal.KafkaTypeFloat {
			return ExtractEventValue(internal.KafkaTypeFloat64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeFloat64, internal.KafkaTypeFloat, fieldType)
	case internal.CHTypeEnum8, internal.CHTypeEnum16, internal.CHTypeUUID, internal.CHTypeFString, internal.CHTypeLCString, internal.CHTypeLCFString:
		if fieldType != internal.KafkaTypeString {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", internal.KafkaTypeString, fieldType)
		}
		return ExtractEventValue(internal.KafkaTypeString, data)
	case internal.CHTypeString:
		if fieldType == internal.KafkaTypeString || fieldType == internal.KafkaTypeBytes {
			return ExtractEventValue(internal.KafkaTypeString, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", internal.KafkaTypeString, internal.KafkaTypeBytes, fieldType)
	case internal.CHTypeDateTime, internal.CHTypeDateTime64, internal.CHTypeLCDateTime:
		switch fieldType {
		case internal.KafkaTypeInt, internal.KafkaTypeInt32, internal.KafkaTypeInt64:
			return ParseDateTimeFromInt64(data)
		case internal.KafkaTypeFloat, internal.KafkaTypeFloat32, internal.KafkaTypeFloat64:
			return ParseDateTimeFromFloat64(data)
		case internal.KafkaTypeString:
			return ParseDateTimeFromString(data)
		default:
			return zero, fmt.Errorf("mismatched types: expected int, float or string type for DateTime, got %s", fieldType)
		}
	default:
		// Handle DateTime64 with parameters (e.g., "DateTime64(6, 'UTC')")
		if strings.HasPrefix(string(columnType), "DateTime") {
			switch fieldType {
			case internal.KafkaTypeInt, internal.KafkaTypeInt32, internal.KafkaTypeInt64:
				return ParseDateTimeFromInt64(data)
			case internal.KafkaTypeFloat, internal.KafkaTypeFloat32, internal.KafkaTypeFloat64:
				return ParseDateTimeFromFloat64(data)
			case internal.KafkaTypeString:
				return ParseDateTimeFromString(data)
			default:
				return zero, fmt.Errorf("mismatched types: expected int, float or string type for DateTime64, got %s", fieldType)
			}
		}
		// Handle any ClickHouse Map type
		if strings.HasPrefix(string(columnType), "Map(") {
			if fieldType == internal.KafkaTypeMap {
				// Convert map[string]any to map[string]string for ClickHouse compatibility
				return convertMapToStringMap(data)
			}
			if mapData, ok := data.(map[string]any); ok {
				// Convert map[string]any to map[string]string for ClickHouse compatibility
				return convertMapToStringMap(mapData)
			}
			return zero, fmt.Errorf("expected map data for Map type, got %T", data)
		}
		// Handle any ClickHouse Array type
		if strings.HasPrefix(string(columnType), "Array(") {
			// Handle Array(Map(...)) case first
			if strings.Contains(string(columnType), "Map(") {
				if mapArrayData, ok := data.([]any); ok {
					// Convert array of maps to array of map[string]string for ClickHouse compatibility
					return convertMapArrayToStringMapArray(mapArrayData)
				}
				return zero, fmt.Errorf("expected array of maps for Array(Map) type, got %T", data)
			}
			// Handle other Array types
			if fieldType == internal.KafkaTypeArray {
				return data, nil
			}
			if arrayData, ok := data.([]any); ok {
				jsonBytes, err := json.Marshal(arrayData)
				if err != nil {
					return zero, fmt.Errorf("failed to marshal array to JSON: %w", err)
				}
				return string(jsonBytes), nil
			}
			return zero, fmt.Errorf("expected array data for Array type, got %T", data)
		}
		return zero, fmt.Errorf("unsupported ClickHouse data type: %s", columnType)
	}
}

func GetDefaultValueForKafkaType(kafkaType KafkaDataType) (any, error) {
	// we would get invalid zeroValue only if there's unknown type
	zeroValue, err := ExtractEventValue(kafkaType, "")
	if err != nil && errors.Is(err, ErrUnknownFieldType) {
		return nil, err
	}

	return zeroValue, nil
}

// ConvertFastjsonValue converts a fastjson.Value directly to the target ClickHouse type,
// avoiding intermediate Go type allocations.
func ConvertFastjsonValue(columnType ClickHouseDataType, fieldType KafkaDataType, v *fastjson.Value) (any, error) {
	if v == nil || v.Type() == fastjson.TypeNull {
		return nil, nil
	}

	switch columnType {
	case internal.CHTypeBool:
		return v.GetBool(), nil

	case internal.CHTypeInt8, internal.CHTypeLCInt8:
		i, err := v.Int64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse int8: %w", err)
		}
		if i < math.MinInt8 || i > math.MaxInt8 {
			return nil, fmt.Errorf("value out of range for int8: %d", i)
		}
		return int8(i), nil

	case internal.CHTypeInt16, internal.CHTypeLCInt16:
		i, err := v.Int64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse int16: %w", err)
		}
		if i < math.MinInt16 || i > math.MaxInt16 {
			return nil, fmt.Errorf("value out of range for int16: %d", i)
		}
		return int16(i), nil

	case internal.CHTypeInt32, internal.CHTypeLCInt32:
		i, err := v.Int64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse int32: %w", err)
		}
		if i < math.MinInt32 || i > math.MaxInt32 {
			return nil, fmt.Errorf("value out of range for int32: %d", i)
		}
		return int32(i), nil

	case internal.CHTypeInt64, internal.CHTypeLCInt64:
		i, err := v.Int64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse int64: %w", err)
		}
		return i, nil

	case internal.CHTypeUInt8, internal.CHTypeLCUInt8:
		u, err := v.Uint64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse uint8: %w", err)
		}
		if u > math.MaxUint8 {
			return nil, fmt.Errorf("value out of range for uint8: %d", u)
		}
		return uint8(u), nil

	case internal.CHTypeUInt16, internal.CHTypeLCUInt16:
		u, err := v.Uint64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse uint16: %w", err)
		}
		if u > math.MaxUint16 {
			return nil, fmt.Errorf("value out of range for uint16: %d", u)
		}
		return uint16(u), nil

	case internal.CHTypeUInt32, internal.CHTypeLCUInt32:
		u, err := v.Uint64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse uint32: %w", err)
		}
		if u > math.MaxUint32 {
			return nil, fmt.Errorf("value out of range for uint32: %d", u)
		}
		return uint32(u), nil

	case internal.CHTypeUInt64, internal.CHTypeLCUInt64:
		u, err := v.Uint64()
		if err != nil {
			return nil, fmt.Errorf("failed to parse uint64: %w", err)
		}
		return u, nil

	case internal.CHTypeFloat32, internal.CHTypeLCFloat32:
		f := v.GetFloat64()
		if f < -math.MaxFloat32 || f > math.MaxFloat32 {
			return nil, fmt.Errorf("value out of range for float32: %f", f)
		}
		return float32(f), nil

	case internal.CHTypeFloat64, internal.CHTypeLCFloat64:
		return v.GetFloat64(), nil

	case internal.CHTypeString, internal.CHTypeEnum8, internal.CHTypeEnum16, internal.CHTypeUUID,
		internal.CHTypeFString, internal.CHTypeLCString, internal.CHTypeLCFString:
		// GetStringBytes returns the underlying bytes without allocation
		// We need to copy to string for safety (fastjson reuses buffer)
		return string(v.GetStringBytes()), nil

	case internal.CHTypeDateTime, internal.CHTypeDateTime64, internal.CHTypeLCDateTime:
		return parseFastjsonDateTime(v, fieldType)

	default:
		// Handle DateTime64 with parameters
		if strings.HasPrefix(string(columnType), "DateTime") {
			return parseFastjsonDateTime(v, fieldType)
		}
		// Handle Array types
		if strings.HasPrefix(string(columnType), "Array(") {
			return parseFastjsonArray(v, columnType)
		}
		// Handle Map types
		if strings.HasPrefix(string(columnType), "Map(") {
			return parseFastjsonMap(v)
		}
		return nil, fmt.Errorf("unsupported ClickHouse type: %s", columnType)
	}
}

// parseFastjsonDateTime parses a datetime value from fastjson
func parseFastjsonDateTime(v *fastjson.Value, fieldType KafkaDataType) (time.Time, error) {
	switch v.Type() {
	case fastjson.TypeNumber:
		// Try as integer timestamp first
		if i, err := v.Int64(); err == nil {
			return time.Unix(i, 0), nil
		}
		// Try as float timestamp
		f := v.GetFloat64()
		sec, frac := math.Modf(f)
		return time.Unix(int64(sec), int64(frac*1e9)), nil

	case fastjson.TypeString:
		s := string(v.GetStringBytes())
		return parseDateTime(s)

	default:
		return time.Time{}, fmt.Errorf("cannot parse datetime from %s", v.Type())
	}
}

// parseDateTime tries common datetime formats (optimized order)
func parseDateTime(s string) (time.Time, error) {
	// Try most common formats first
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05.999999",
		"2006-01-02 15:04:05.999",
		"2006-01-02",
	}

	for _, layout := range formats {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unable to parse datetime: %s", s)
}

// parseFastjsonArray converts a fastjson array to []any
func parseFastjsonArray(v *fastjson.Value, columnType ClickHouseDataType) ([]any, error) {
	arr := v.GetArray()
	if arr == nil {
		return nil, nil
	}

	result := make([]any, len(arr))
	for i, item := range arr {
		result[i] = fastjsonToGoValue(item)
	}
	return result, nil
}

// parseFastjsonMap converts a fastjson object to map[string]string
func parseFastjsonMap(v *fastjson.Value) (map[string]string, error) {
	obj, err := v.Object()
	if err != nil {
		return nil, fmt.Errorf("expected object for Map type: %w", err)
	}

	result := make(map[string]string)
	obj.Visit(func(key []byte, val *fastjson.Value) {
		switch val.Type() {
		case fastjson.TypeString:
			result[string(key)] = string(val.GetStringBytes())
		case fastjson.TypeNumber:
			result[string(key)] = val.String()
		case fastjson.TypeTrue:
			result[string(key)] = "true"
		case fastjson.TypeFalse:
			result[string(key)] = "false"
		case fastjson.TypeNull:
			result[string(key)] = ""
		default:
			result[string(key)] = val.String()
		}
	})
	return result, nil
}

// fastjsonToGoValue converts fastjson.Value to Go value (minimal version for arrays)
func fastjsonToGoValue(v *fastjson.Value) any {
	if v == nil {
		return nil
	}
	switch v.Type() {
	case fastjson.TypeNull:
		return nil
	case fastjson.TypeString:
		return string(v.GetStringBytes())
	case fastjson.TypeNumber:
		if i, err := v.Int64(); err == nil {
			return i
		}
		return v.GetFloat64()
	case fastjson.TypeTrue:
		return true
	case fastjson.TypeFalse:
		return false
	default:
		return v.String()
	}
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
