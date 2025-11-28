package json

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/expr-lang/expr"
	"github.com/expr-lang/expr/vm"
	"github.com/spf13/cast"
)

type TransformationConfig struct {
	Expr         string `json:"expr"`
	OutputColumn string `json:"output_column"`
	Type         string `json:"type"`
}

type Transformer struct {
	Transformations     []TransformationConfig
	compiledExpressions []*vm.Program
}

// NewTransformer creates a new Transformer and compiles all expressions
func NewTransformer(transformations []TransformationConfig) (*Transformer, error) {
	compiledExpressions := make([]*vm.Program, len(transformations))
	for i, transformation := range transformations {
		program, err := expr.Compile(
			transformation.Expr,
			expr.Function("concat", concat),
			expr.Function("parseQuery", parseQueryString),
			expr.Function("getQueryParam", getQueryParam),
			expr.Function("getNestedParam", getNestedParam),
			expr.Function("urlDecode", urlDecode),
			expr.Function("extractPathType", extractPathType),
			expr.Function("waterfall", waterfall),
			expr.Function("parseUserAgent", parseUserAgent),
			expr.Function("hasKeyPrefix", hasKeyPrefix),
			expr.Function("hasAnyKey", hasAnyKey),
			expr.Function("parseISO8601", parseISO8601),
			expr.Function("toDate", toClickHouseDate),
		)
		if err != nil {
			return nil, fmt.Errorf("compile transformation %d expression: %w", i, err)
		}
		compiledExpressions[i] = program
	}

	return &Transformer{
		Transformations:     transformations,
		compiledExpressions: compiledExpressions,
	}, nil
}

// Transform applies transformations to input bytes and returns transformed bytes
func (t *Transformer) Transform(inputBytes []byte) ([]byte, error) {
	if len(t.compiledExpressions) == 0 {
		return inputBytes, nil
	}
	var inputData map[string]any
	if err := json.Unmarshal(inputBytes, &inputData); err != nil {
		return nil, fmt.Errorf("unmarshal input data: %w", err)
	}

	outputData := make(map[string]any)
	for i, transformation := range t.Transformations {
		result, err := expr.Run(t.compiledExpressions[i], inputData)
		if err != nil {
			return nil, fmt.Errorf("run transformation %d: %w", i, err)
		}

		convertedValue, err := convertType(result, transformation.Type)
		if err != nil {
			return nil, fmt.Errorf("convert result for column %s: %w", transformation.OutputColumn, err)
		}

		outputData[transformation.OutputColumn] = convertedValue
	}

	outputBytes, err := json.Marshal(outputData)
	if err != nil {
		return nil, fmt.Errorf("marshal output data: %w", err)
	}

	return outputBytes, nil
}

// concat is a helper function for concatenating strings in expressions
func concat(args ...any) (any, error) {
	var builder strings.Builder
	for _, arg := range args {
		builder.WriteString(fmt.Sprint(arg))
	}
	return builder.String(), nil
}

func convertType(value any, targetType string) (any, error) {
	switch targetType {
	case "string":
		return cast.ToStringE(value)
	case "int":
		return cast.ToIntE(value)
	case "int64":
		return cast.ToInt64E(value)
	case "float64":
		return cast.ToFloat64E(value)
	case "bool":
		return cast.ToBoolE(value)
	default:
		return value, nil
	}
}

// Custom transformation functions

// parseQueryString parses a URL query string into a map
func parseQueryString(args ...any) (any, error) {
	if len(args) == 0 {
		return map[string]any{}, nil
	}
	queryStr := cast.ToString(args[0])
	result := make(map[string]any)

	if queryStr == "" {
		return result, nil
	}

	values, err := url.ParseQuery(queryStr)
	if err != nil {
		return result, nil
	}

	for key, vals := range values {
		if len(vals) == 1 {
			result[key] = vals[0]
		} else {
			result[key] = vals
		}
	}

	return result, nil
}

// getQueryParam extracts a specific parameter from query string
func getQueryParam(args ...any) (any, error) {
	if len(args) < 2 {
		return "", nil
	}
	queryStr := cast.ToString(args[0])
	param := cast.ToString(args[1])

	parsed, _ := parseQueryString(queryStr)
	parsedMap := parsed.(map[string]any)

	if val, ok := parsedMap[param]; ok {
		if str, ok := val.(string); ok {
			return str, nil
		}
	}
	return "", nil
}

// getNestedParam extracts nested parameters like "ep.event_id"
func getNestedParam(args ...any) (any, error) {
	if len(args) < 2 {
		return "", nil
	}
	queryStr := cast.ToString(args[0])
	param := cast.ToString(args[1])

	parsed, _ := parseQueryString(queryStr)
	parsedMap := parsed.(map[string]any)

	if val, ok := parsedMap[param]; ok {
		if str, ok := val.(string); ok {
			return str, nil
		}
	}
	return "", nil
}

// extractPathType extracts request type from path
func extractPathType(args ...any) (any, error) {
	if len(args) == 0 {
		return "unknown", nil
	}
	path := cast.ToString(args[0])

	switch path {
	case "/g/collect":
		return "collect", nil
	case "/_/set_cookie":
		return "set_cookie", nil
	default:
		return "unknown", nil
	}
}

// hasKeyPrefix checks if any key in the map starts with given prefixes
func hasKeyPrefix(args ...any) (any, error) {
	if len(args) < 2 {
		return false, nil
	}

	dataArg := args[0]
	prefixesArg := args[1]

	data, ok := dataArg.(map[string]any)
	if !ok {
		return false, nil
	}

	prefixes, ok := prefixesArg.([]any)
	if !ok {
		return false, nil
	}

	for key := range data {
		for _, prefix := range prefixes {
			if prefixStr := cast.ToString(prefix); strings.HasPrefix(key, prefixStr) {
				return true, nil
			}
		}
	}
	return false, nil
}

// hasAnyKey checks if any of the specified keys exist in the map
func hasAnyKey(args ...any) (any, error) {
	if len(args) < 2 {
		return false, nil
	}

	dataArg := args[0]
	keysArg := args[1]

	data, ok := dataArg.(map[string]any)
	if !ok {
		return false, nil
	}

	keys, ok := keysArg.([]any)
	if !ok {
		return false, nil
	}

	for _, key := range keys {
		if keyStr := cast.ToString(key); len(keyStr) > 0 {
			if _, exists := data[keyStr]; exists {
				return true, nil
			}
		}
	}
	return false, nil
}

// waterfall returns the first non-empty value from a list
func waterfall(args ...any) (any, error) {
	if len(args) == 0 {
		return "", nil
	}

	// If first arg is a slice, use that
	if slice, ok := args[0].([]any); ok {
		for _, val := range slice {
			if val != nil {
				if str, ok := val.(string); ok {
					if str != "" {
						return str, nil
					}
					continue
				}
				return val, nil
			}
		}
		return "", nil
	}

	// Otherwise use args directly
	for _, val := range args {
		if val != nil {
			if str, ok := val.(string); ok {
				if str != "" {
					return str, nil
				}
				continue
			}
			return val, nil
		}
	}
	return "", nil
}

// parseISO8601 parses ISO8601 timestamp
func parseISO8601(args ...any) (any, error) {
	if len(args) == 0 {
		return time.Time{}, nil
	}
	timestamp := cast.ToString(args[0])

	formats := []string{
		"2006-01-02 15:04:05.000000",
		"2006-01-02T15:04:05.000000Z",
		"2006-01-02T15:04:05Z",
		time.RFC3339,
	}

	for _, format := range formats {
		if t, err := time.Parse(format, timestamp); err == nil {
			return t, nil
		}
	}

	return time.Time{}, nil
}

// toClickHouseDate converts time to ClickHouse date format
func toClickHouseDate(args ...any) (any, error) {
	if len(args) == 0 {
		return "", nil
	}

	if t, ok := args[0].(time.Time); ok {
		return t.Format("2006-01-02"), nil
	}
	return "", nil
}

// parseUserAgent extracts information from user agent string
func parseUserAgent(args ...any) (any, error) {
	if len(args) < 2 {
		return "", nil
	}
	userAgent := cast.ToString(args[0])
	field := cast.ToString(args[1])

	if userAgent == "" {
		return "", nil
	}

	switch field {
	case "device":
		if strings.Contains(userAgent, "Mobile") || strings.Contains(userAgent, "iPhone") {
			return "Mobile", nil
		} else if strings.Contains(userAgent, "Tablet") || strings.Contains(userAgent, "iPad") {
			return "Tablet", nil
		}
		return "Desktop", nil
	case "browser":
		if strings.Contains(userAgent, "Chrome") {
			return "Chrome", nil
		} else if strings.Contains(userAgent, "Firefox") {
			return "Firefox", nil
		} else if strings.Contains(userAgent, "Safari") {
			return "Safari", nil
		}
		return "Unknown", nil
	case "os":
		if strings.Contains(userAgent, "Windows") {
			return "Windows", nil
		} else if strings.Contains(userAgent, "Mac OS") {
			return "macOS", nil
		} else if strings.Contains(userAgent, "Linux") {
			return "Linux", nil
		}
		return "Unknown", nil
	}
	return "", nil
}

// urlDecode decodes URL-encoded string
func urlDecode(args ...any) (any, error) {
	if len(args) == 0 {
		return "", nil
	}
	s := cast.ToString(args[0])
	decoded, err := url.QueryUnescape(s)
	if err != nil {
		return s, nil
	}
	return decoded, nil
}
