package internal

// NormalizeToBasicKafkaType maps precision type strings to the seven basic Kafka/source types.
// Precision types (int8, int16, int32, int64, uint8, uint16, uint32, uint64, float32, float64, bytes)
// are normalized to int, uint, float, or string. The seven basic types are returned as-is.
func NormalizeToBasicKafkaType(typeStr string) string {
	switch typeStr {
	case "int8", "int16", "int32", "int64":
		return KafkaTypeInt
	case "uint8", "uint16", "uint32", "uint64":
		return KafkaTypeUint
	case "float32", "float64":
		return KafkaTypeFloat
	case "bytes":
		return KafkaTypeString
	case KafkaTypeString, KafkaTypeBool, KafkaTypeInt, KafkaTypeUint, KafkaTypeFloat, KafkaTypeArray, KafkaTypeMap:
		return typeStr
	default:
		return typeStr
	}
}
