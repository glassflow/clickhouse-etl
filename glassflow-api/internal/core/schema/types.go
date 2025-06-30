package schema

import "fmt"

type (
	KafkaDataType      string
	ClickHouseDataType string
)

const (
	// Kafka data types
	KafkaTypeString KafkaDataType = "string"
	KafkaTypeBool   KafkaDataType = "bool"

	KafkaTypeInt   KafkaDataType = "int"
	KafkaTypeInt8  KafkaDataType = "int8"
	KafkaTypeInt16 KafkaDataType = "int16"
	KafkaTypeInt32 KafkaDataType = "int32"
	KafkaTypeInt64 KafkaDataType = "int64"

	KafkaTypeUint   KafkaDataType = "uint"
	KafkaTypeUint8  KafkaDataType = "uint8"
	KafkaTypeUint16 KafkaDataType = "uint16"
	KafkaTypeUint32 KafkaDataType = "uint32"
	KafkaTypeUint64 KafkaDataType = "uint64"

	KafkaTypeFloat   KafkaDataType = "float"
	KafkaTypeFloat32 KafkaDataType = "float32"
	KafkaTypeFloat64 KafkaDataType = "float64"

	KafkaTypeBytes KafkaDataType = "bytes"
)

const (
	// ClickHouse data types
	CHTypeString  ClickHouseDataType = "String"
	CHTypeFString ClickHouseDataType = "FixedString"
	CHTypeBool    ClickHouseDataType = "Bool"
	CHTypeInt8    ClickHouseDataType = "Int8"
	CHTypeInt16   ClickHouseDataType = "Int16"
	CHTypeInt32   ClickHouseDataType = "Int32"
	CHTypeInt64   ClickHouseDataType = "Int64"

	CHTypeLCInt8  ClickHouseDataType = "LowCardinality(Int8)"
	CHTypeLCInt16 ClickHouseDataType = "LowCardinality(Int16)"
	CHTypeLCInt32 ClickHouseDataType = "LowCardinality(Int32)"
	CHTypeLCInt64 ClickHouseDataType = "LowCardinality(Int64)"

	CHTypeUInt8  ClickHouseDataType = "UInt8"
	CHTypeUInt16 ClickHouseDataType = "UInt16"
	CHTypeUInt32 ClickHouseDataType = "UInt32"
	CHTypeUInt64 ClickHouseDataType = "UInt64"

	CHTypeLCUInt8  ClickHouseDataType = "LowCardinality(UInt8)"
	CHTypeLCUInt16 ClickHouseDataType = "LowCardinality(UInt16)"
	CHTypeLCUInt32 ClickHouseDataType = "LowCardinality(UInt32)"
	CHTypeLCUInt64 ClickHouseDataType = "LowCardinality(UInt64)"

	CHTypeFloat32 ClickHouseDataType = "Float32"
	CHTypeFloat64 ClickHouseDataType = "Float64"

	CHTypeLCFloat32 ClickHouseDataType = "LowCardinality(Float32)"
	CHTypeLCFloat64 ClickHouseDataType = "LowCardinality(Float64)"

	CHTypeEnum8  ClickHouseDataType = "Enum8"
	CHTypeEnum16 ClickHouseDataType = "Enum16"

	CHTypeDateTime   ClickHouseDataType = "DateTime"
	CHTypeDateTime64 ClickHouseDataType = "DateTime64"

	CHTypeUUID ClickHouseDataType = "UUID"

	CHTypeLCString  ClickHouseDataType = "LowCardinality(String)"
	CHTypeLCFString ClickHouseDataType = "LowCardinality(FixedString)"

	CHTypeLCDateTime ClickHouseDataType = "LowCardinality(DateTime)"
)

func ExtractEventValue(dataType KafkaDataType, data any) (zero any, _ error) {
	switch dataType {
	case KafkaTypeString:
		return ParseString(data)
	case KafkaTypeBytes:
		return ParseBytes(data)
	case KafkaTypeBool:
		return ParseBool(data)
	case KafkaTypeInt:
		return ParseInt64(data)
	case KafkaTypeInt8:
		return ParseInt8(data)
	case KafkaTypeInt16:
		return ParseInt16(data)
	case KafkaTypeInt32:
		return ParseInt32(data)
	case KafkaTypeInt64:
		return ParseInt64(data)
	case KafkaTypeUint:
		return ParseUint64(data)
	case KafkaTypeUint8:
		return ParseUint8(data)
	case KafkaTypeUint16:
		return ParseUint16(data)
	case KafkaTypeUint32:
		return ParseUint32(data)
	case KafkaTypeUint64:
		return ParseUint64(data)
	case KafkaTypeFloat:
		return ParseFloat64(data)
	case KafkaTypeFloat32:
		return ParseFloat32(data)
	case KafkaTypeFloat64:
		return ParseFloat64(data)
	default:
		return zero, nil
	}
}

func ConvertValue(columnType ClickHouseDataType, fieldType KafkaDataType, data any) (zero any, _ error) {
	switch columnType {
	case CHTypeBool:
		if fieldType != KafkaTypeBool {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", KafkaTypeBool, fieldType)
		}
		return ExtractEventValue(KafkaTypeBool, data)
	case CHTypeInt8, CHTypeLCInt8:
		if fieldType == KafkaTypeInt8 || fieldType == KafkaTypeInt {
			return ExtractEventValue(KafkaTypeInt8, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeInt8, KafkaTypeInt, fieldType)
	case CHTypeInt16, CHTypeLCInt16:
		if fieldType == KafkaTypeInt16 || fieldType == KafkaTypeInt {
			return ExtractEventValue(KafkaTypeInt16, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeInt16, KafkaTypeInt, fieldType)
	case CHTypeInt32, CHTypeLCInt32:
		if fieldType == KafkaTypeInt32 || fieldType == KafkaTypeInt {
			return ExtractEventValue(KafkaTypeInt32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeInt32, KafkaTypeInt, fieldType)
	case CHTypeInt64, CHTypeLCInt64:
		if fieldType == KafkaTypeInt64 || fieldType == KafkaTypeInt {
			return ExtractEventValue(KafkaTypeInt64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeInt64, KafkaTypeInt, fieldType)
	case CHTypeUInt8, CHTypeLCUInt8:
		if fieldType == KafkaTypeUint8 || fieldType == KafkaTypeUint {
			return ExtractEventValue(KafkaTypeUint8, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeUint8, KafkaTypeUint, fieldType)
	case CHTypeUInt16, CHTypeLCUInt16:
		if fieldType == KafkaTypeUint16 || fieldType == KafkaTypeUint {
			return ExtractEventValue(KafkaTypeUint16, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeUint16, KafkaTypeUint, fieldType)
	case CHTypeUInt32, CHTypeLCUInt32:
		if fieldType == KafkaTypeUint32 || fieldType == KafkaTypeUint {
			return ExtractEventValue(KafkaTypeUint32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeUint32, KafkaTypeUint, fieldType)
	case CHTypeUInt64, CHTypeLCUInt64:
		if fieldType == KafkaTypeUint64 || fieldType == KafkaTypeUint {
			return ExtractEventValue(KafkaTypeUint64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeUint64, KafkaTypeUint, fieldType)
	case CHTypeFloat32, CHTypeLCFloat32:
		if fieldType == KafkaTypeFloat32 || fieldType == KafkaTypeFloat {
			return ExtractEventValue(KafkaTypeFloat32, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeFloat32, KafkaTypeFloat, fieldType)
	case CHTypeFloat64, CHTypeLCFloat64:
		if fieldType == KafkaTypeFloat64 || fieldType == KafkaTypeFloat {
			return ExtractEventValue(KafkaTypeFloat64, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeFloat64, KafkaTypeFloat, fieldType)
	case CHTypeEnum8, CHTypeEnum16, CHTypeUUID, CHTypeFString, CHTypeLCString, CHTypeLCFString:
		if fieldType != KafkaTypeString {
			return zero, fmt.Errorf("mismatched types: expected %s, got %s", KafkaTypeString, fieldType)
		}
		return ExtractEventValue(KafkaTypeString, data)
	case CHTypeString:
		if fieldType == KafkaTypeString || fieldType == KafkaTypeBytes {
			return ExtractEventValue(KafkaTypeString, data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s or %s, got %s", KafkaTypeString, KafkaTypeBytes, fieldType)
	case CHTypeDateTime, CHTypeDateTime64, CHTypeLCDateTime:
		if fieldType == KafkaTypeInt64 {
			return ParseDateTimeFromInt64(data)
		}
		if fieldType == KafkaTypeFloat64 {
			return ParseDateTimeFromFloat64(data)
		}
		if fieldType == KafkaTypeString {
			return ParseDateTimeFromString(data)
		}
		return zero, fmt.Errorf("mismatched types: expected %s, %s or %s, got %s", KafkaTypeInt64, KafkaTypeFloat64, KafkaTypeString, fieldType)
	default:
		return zero, fmt.Errorf("unsupported ClickHouse data type: %s", columnType)
	}
}
