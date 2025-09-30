package schema

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
)

type (
	KafkaDataType      string
	ClickHouseDataType string
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
	default:
		return zero, nil
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
		if fieldType == internal.KafkaTypeInt64 {
			return ParseDateTimeFromInt64(data)
		}
		if fieldType == internal.KafkaTypeFloat64 {
			return ParseDateTimeFromFloat64(data)
		}
		if fieldType == internal.KafkaTypeString {
			return ParseDateTimeFromString(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s, %s or %s, got %s", internal.KafkaTypeInt64, internal.KafkaTypeFloat64, internal.KafkaTypeString, fieldType)
	default:
		// Handle any ClickHouse Array type
		if strings.HasPrefix(string(columnType), "Array(") {
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
