package schema

import (
	"fmt"
	"math"
	"reflect"
	"strconv"
	"time"
)

func ParseString(data any) (zero string, _ error) {
	switch value := data.(type) {
	case string:
		return value, nil
	case nil:
		return "", nil // Handle null values by returning empty string
	default:
		return zero, fmt.Errorf("failed to parse string: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseBool(data any) (zero bool, _ error) {
	switch value := data.(type) {
	case bool:
		return value, nil
	case nil:
		return false, nil // Handle null values by returning false
	default:
		return zero, fmt.Errorf("failed to parse bool: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseInt8(data any) (zero int8, _ error) {
	switch value := data.(type) {
	case int8:
		return value, nil
	case int:
		if value < math.MinInt8 || value > math.MaxInt8 {
			return zero, fmt.Errorf("value out of range of int8: %d", value)
		}
		return int8(value), nil
	case float64:
		if value < float64(math.MinInt8) || value > float64(math.MaxInt8) {
			return zero, fmt.Errorf("value out of range of int8: %f", value)
		}
		return int8(value), nil
	default:
		return zero, fmt.Errorf("failed to parse int8: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseInt16(data any) (zero int16, _ error) {
	switch value := data.(type) {
	case int16:
		return value, nil
	case int:
		if value < math.MinInt16 || value > math.MaxInt16 {
			return zero, fmt.Errorf("value out of range of int16: %d", value)
		}
		return int16(value), nil
	case float64:
		if value < float64(math.MinInt16) || value > float64(math.MaxInt16) {
			return zero, fmt.Errorf("value out of range of int16: %f", value)
		}
		return int16(value), nil
	default:
		return zero, fmt.Errorf("failed to parse int16: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseInt32(data any) (zero int32, _ error) {
	switch value := data.(type) {
	case int32:
		return value, nil
	case int:
		if value < math.MinInt32 || value > math.MaxInt32 {
			return zero, fmt.Errorf("value out of range of int32: %d", value)
		}
		return int32(value), nil
	case float64:
		if value < float64(math.MinInt32) || value > float64(math.MaxInt32) {
			return zero, fmt.Errorf("value out of range of int32: %f", value)
		}
		return int32(value), nil
	case nil:
		return 0, nil // Handle null values by returning 0
	default:
		return zero, fmt.Errorf("failed to parse int32: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseInt64(data any) (zero int64, _ error) {
	switch value := data.(type) {
	case int64:
		return value, nil
	case int:
		return int64(value), nil
	case float64:
		if value < float64(math.MinInt64) || value > float64(math.MaxInt64) {
			return zero, fmt.Errorf("value out of range of int64: %f", value)
		}
		return int64(value), nil
	default:
		return zero, fmt.Errorf("failed to parse int64: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseUint8(data any) (zero uint8, _ error) {
	switch value := data.(type) {
	case string:
		u, err := strconv.ParseUint(value, 10, 8)
		if err != nil {
			return zero, fmt.Errorf("failed to parse uint8: %w", err)
		}
		if u > math.MaxUint8 {
			return zero, fmt.Errorf("value out of range of uint8: %d", u)
		}
		return uint8(u), nil
	case uint8:
		return value, nil
	case uint:
		if value > math.MaxUint8 {
			return zero, fmt.Errorf("value out of range of uint8: %d", value)
		}
		return uint8(value), nil
	case float64:
		if value > float64(math.MaxUint8) {
			return zero, fmt.Errorf("value out of range of uint8: %f", value)
		}
		return uint8(value), nil
	default:
		return zero, fmt.Errorf("failed to parse uint8: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseUint16(data any) (zero uint16, _ error) {
	switch value := data.(type) {
	case string:
		u, err := strconv.ParseUint(value, 10, 16)
		if err != nil {
			return zero, fmt.Errorf("failed to parse uint16: %w", err)
		}
		if u > math.MaxUint16 {
			return zero, fmt.Errorf("value out of range of uint16: %d", u)
		}
		return uint16(u), nil
	case uint16:
		return value, nil
	case uint:
		if value > math.MaxUint16 {
			return zero, fmt.Errorf("value out of range of uint16: %d", value)
		}
		return uint16(value), nil
	case float64:
		if value > float64(math.MaxUint16) {
			return zero, fmt.Errorf("value out of range of uint16: %f", value)
		}
		return uint16(value), nil
	default:
		return zero, fmt.Errorf("failed to parse uint16: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseUint32(data any) (zero uint32, _ error) {
	switch value := data.(type) {
	case string:
		u, err := strconv.ParseUint(value, 10, 32)
		if err != nil {
			return zero, fmt.Errorf("failed to parse uint32: %w", err)
		}
		if u > math.MaxUint32 {
			return zero, fmt.Errorf("value out of range of uint32: %d", u)
		}
		return uint32(u), nil
	case uint32:
		return value, nil
	case uint:
		if value > math.MaxUint32 {
			return zero, fmt.Errorf("value out of range of uint32: %d", value)
		}
		return uint32(value), nil
	case float64:
		if value > float64(math.MaxUint32) {
			return zero, fmt.Errorf("value out of range of uint32: %f", value)
		}
		return uint32(value), nil
	default:
		return zero, fmt.Errorf("failed to parse uint32: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseUint64(data any) (zero uint64, _ error) {
	switch value := data.(type) {
	case string:
		u, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return zero, fmt.Errorf("failed to parse uint64: %w", err)
		}
		return u, nil
	case uint64:
		return value, nil
	case uint:
		return uint64(value), nil
	case float64:
		if value > float64(math.MaxUint64) {
			return zero, fmt.Errorf("value out of range of uint64: %f", value)
		}
		return uint64(value), nil
	default:
		return zero, fmt.Errorf("failed to parse uint64: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseFloat32(data any) (zero float32, _ error) {
	switch value := data.(type) {
	case float64:
		if value < float64(math.SmallestNonzeroFloat32) || value > float64(math.MaxFloat32) {
			return zero, fmt.Errorf("float32 out of range: %f", value)
		}
		return float32(value), nil
	case float32:
		return value, nil
	case nil:
		return 0, nil // Handle null values by returning 0
	default:
		return zero, fmt.Errorf("failed to parse float32: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseFloat64(data any) (zero float64, _ error) {
	switch value := data.(type) {
	case []byte:
		f, err := strconv.ParseFloat(string(value), 64)
		if err != nil {
			return zero, fmt.Errorf("failed to parse float64: %w", err)
		}
		if f < math.SmallestNonzeroFloat64 || f > math.MaxFloat64 {
			return zero, fmt.Errorf("float64 out of range: %f", f)
		}
		return f, nil
	case float64:
		return value, nil
	case nil:
		return 0, nil // Handle null values by returning 0
	default:
		return zero, fmt.Errorf("failed to parse float64: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseBytes(data any) (zero string, _ error) {
	switch value := data.(type) {
	case []byte:
		return string(value), nil
	default:
		return zero, fmt.Errorf("failed to parse bytes: %v, type is: %v", data, reflect.TypeOf(data))
	}
}

func ParseDateTimeFromString(data any) (zero time.Time, _ error) {
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

	timestr, err := ParseString(data)
	if err != nil {
		return zero, fmt.Errorf("failed to parse string: %w", err)
	}

	for _, layout := range formats {
		if t, err := time.Parse(layout, timestr); err == nil {
			return t, nil
		}
	}

	return zero, fmt.Errorf("unable to parse datetime from '%v'", data)
}

func ParseDateTimeFromInt64(data any) (zero time.Time, _ error) {
	timestamp, err := ParseInt64(data)
	if err != nil {
		return zero, fmt.Errorf("failed to parse int64: %w", err)
	}

	if timestamp < 0 {
		return zero, fmt.Errorf("negative timestamp: %d", timestamp)
	}

	return time.Unix(timestamp, 0), nil
}

func ParseDateTimeFromFloat64(data any) (zero time.Time, _ error) {
	timestamp, err := ParseFloat64(data)
	if err != nil {
		return zero, fmt.Errorf("failed to parse float64: %w", err)
	}

	if timestamp < 0 {
		return zero, fmt.Errorf("negative timestamp: %f", timestamp)
	}

	if timestamp == 0 {
		return zero, nil
	}

	sec, dec := math.Modf(timestamp)
	return time.Unix(int64(sec), int64(dec*1e9)), nil
}
