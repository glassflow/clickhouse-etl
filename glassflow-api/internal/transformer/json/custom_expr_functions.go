package json

import (
	"fmt"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cast"
)

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
	return getNestedParam(args...)
}

func getNestedParam(args ...any) (any, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("getNestedParam requires 2 arguments, got %d", len(args))
	}

	queryStr := cast.ToString(args[0])
	param := cast.ToString(args[1])

	parsed, err := parseQueryString(queryStr)
	if err != nil {
		return "", nil
	}

	parsedMap, ok := parsed.(map[string]any)
	if !ok {
		return "", nil
	}

	if val, ok := parsedMap[param]; ok {
		if str, ok := val.(string); ok {
			return str, nil
		}
		// Value exists but isn't a string - could be []string
		return val, nil
	}

	return "", nil
}

// extractPathType extracts request type from path
func extractPathType(args ...any) (any, error) {
	if len(args) == 0 {
		return "unknown", fmt.Errorf("extractPathType requires 1 argument, got %d", len(args))
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
		return false, fmt.Errorf("hasKeyPrefix requires 2 arguments, got %d", len(args))
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
		return false, fmt.Errorf("hasAnyKey requires 2 arguments, got %d", len(args))
	}

	dataArg := args[0]
	keysArg := args[1]

	data, ok := dataArg.(map[string]any)
	if !ok {
		return false, nil
	}

	keysInput, ok := keysArg.([]any)
	if !ok {
		return false, nil
	}

	for _, key := range keysInput {
		if keyStr := cast.ToString(key); len(keyStr) > 0 {
			if _, exists := data[keyStr]; exists {
				return true, nil
			}
		}
	}

	return false, nil
}

func waterfall(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("waterfall requires at least 1 argument, got %d", len(args))
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
				return fmt.Sprint(val), nil
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

			return fmt.Sprint(val), nil
		}
	}

	return "", nil
}

// parseISO8601 parses ISO8601 timestamp
func parseISO8601(args ...any) (any, error) {
	if len(args) == 0 {
		return 0, fmt.Errorf("parseISO8601 requires 1 argument, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return 0, nil
	}

	formats := []string{
		"2006-01-02 15:04:05.000000",
		"2006-01-02T15:04:05.000000Z",
		"2006-01-02T15:04:05Z",
		time.RFC3339,
	}

	for _, format := range formats {
		if t, err := time.Parse(format, input); err == nil {
			return t.Unix(), nil
		}
	}

	return 0, nil
}

// toDate converts time to date format
func toDate(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("toDate requires 1 argument, got %d", len(args))
	}

	switch v := args[0].(type) {
	case time.Time:
		return v.Format("2006-01-02"), nil
	case int:
		return time.Unix(int64(v), 0).Format("2006-01-02"), nil
	case int64:
		return time.Unix(v, 0).Format("2006-01-02"), nil
	case float64:
		return time.Unix(int64(v), 0).Format("2006-01-02"), nil
	}

	return 0, nil
}

func parseUserAgent(args ...any) (any, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("parseUserAgent requires 2 arguments, got %d", len(args))
	}
	userAgent := cast.ToString(args[0])
	if userAgent == "" {
		return "", nil
	}

	field := cast.ToString(args[1])

	switch field {
	case "device":
		return detectDevice(userAgent), nil
	case "browser":
		return detectBrowser(userAgent), nil
	case "os":
		return detectOS(userAgent), nil
	default:
		return "", nil
	}
}

func detectDevice(userAgent string) string {
	ua := strings.ToLower(userAgent)

	// Tablet
	if strings.Contains(ua, "ipad") ||
		(strings.Contains(ua, "android") && !strings.Contains(ua, "mobile")) {
		return "Tablet"
	}

	// Mobile
	if strings.Contains(ua, "mobile") ||
		strings.Contains(ua, "iphone") ||
		strings.Contains(ua, "android") {
		return "Mobile"
	}

	return "Desktop"
}

func detectBrowser(userAgent string) string {
	ua := strings.ToLower(userAgent)

	// Check Edge before Chrome
	if strings.Contains(ua, "edg/") {
		return "Edge"
	}

	// Check Chrome
	if strings.Contains(ua, "chrome") || strings.Contains(ua, "crios") {
		return "Chrome"
	}

	// Check Firefox
	if strings.Contains(ua, "firefox") || strings.Contains(ua, "fxios") {
		return "Firefox"
	}

	// Check Safari (must not contain chrome)
	if strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome") {
		return "Safari"
	}

	return "Unknown"
}

func detectOS(userAgent string) string {
	ua := strings.ToLower(userAgent)

	// iOS (check before macOS)
	if strings.Contains(ua, "iphone") ||
		strings.Contains(ua, "ipad") ||
		strings.Contains(ua, "ipod") {
		return "iOS"
	}

	// Android
	if strings.Contains(ua, "android") {
		return "Android"
	}

	// Windows
	if strings.Contains(ua, "windows") {
		return "Windows"
	}

	// macOS
	if strings.Contains(ua, "mac os") || strings.Contains(ua, "macintosh") {
		return "macOS"
	}

	// Linux
	if strings.Contains(ua, "linux") {
		return "Linux"
	}

	return "Unknown"
}

func urlDecode(args ...any) (any, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("urlDecode: expected 1 argument, got %d", len(args))
	}

	str, ok := args[0].(string)
	if !ok {
		return "", nil
	}

	// Handle empty string
	if str == "" {
		return "", nil
	}

	decoded, err := url.QueryUnescape(str)
	if err != nil {
		return "", err
	}
	return decoded, nil
}

func toString(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("toString requires 1 argument, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}

	return input, nil
}

func containsStr(args ...any) (any, error) {
	if len(args) < 2 {
		return false, fmt.Errorf("containsStr requires 2 arguments, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return false, nil
	}
	str := cast.ToString(args[1])

	return strings.Contains(input, str), nil
}

func hasPrefix(args ...any) (any, error) {
	if len(args) < 2 {
		return false, fmt.Errorf("hasPrefix requires 2 arguments, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return false, nil
	}
	str := cast.ToString(args[1])

	return strings.HasPrefix(input, str), nil
}

func hasSuffix(args ...any) (any, error) {
	if len(args) < 2 {
		return false, fmt.Errorf("hasSuffix requires 2 arguments, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return false, nil
	}
	str := cast.ToString(args[1])

	return strings.HasSuffix(input, str), nil
}

func upper(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("upper requires 1 argument, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}

	return strings.ToUpper(input), nil
}

func lower(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("lower requires 1 argument, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}

	return strings.ToLower(input), nil
}

func trimSpaces(args ...any) (any, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("trimSpaces requires 1 argument, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}

	return strings.TrimSpace(input), nil
}

func splitStr(args ...any) (any, error) {
	if len(args) < 2 {
		return []string{}, fmt.Errorf("splitStr requires 2 arguments, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}
	sep := cast.ToString(args[1])

	return strings.Split(input, sep), nil
}

func join(args ...any) (any, error) {
	if len(args) < 2 {
		return "", fmt.Errorf("join requires 2 arguments, got %d", len(args))
	}

	sep := cast.ToString(args[1])

	// Handle slice as first argument
	if slice, ok := args[0].([]any); ok {
		strs := make([]string, 0, len(slice))
		for _, arg := range slice {
			strs = append(strs, cast.ToString(arg))
		}
		return strings.Join(strs, sep), nil
	}

	return "", nil
}

func replace(args ...any) (any, error) {
	if len(args) < 3 {
		return "", fmt.Errorf("replace requires 3 arguments, got %d", len(args))
	}
	input := cast.ToString(args[0])
	if input == "" {
		return "", nil
	}

	oldStr := cast.ToString(args[1])
	newStr := cast.ToString(args[2])

	return strings.ReplaceAll(input, oldStr, newStr), nil
}

func toInt(args ...any) (any, error) {
	if len(args) == 0 {
		return 0, fmt.Errorf("toInt requires 1 argument, got %d", len(args))
	}

	input := cast.ToString(args[0])
	if input == "" {
		return 0, nil
	}
	result, err := strconv.Atoi(input)
	if err != nil {
		return 0, nil
	}

	return result, nil
}

func toFloat(args ...any) (any, error) {
	if len(args) == 0 {
		return 0.0, fmt.Errorf("toFloat requires 1 argument, got %d", len(args))
	}

	input := cast.ToString(args[0])
	if input == "" {
		return 0.0, nil
	}
	result, err := strconv.ParseFloat(input, 64)
	if err != nil {
		return 0.0, nil
	}

	return result, nil
}

func keys(args ...any) (any, error) {
	if len(args) == 0 {
		return []string{}, fmt.Errorf("keys requires 1 argument, got %d", len(args))
	}

	if m, ok := args[0].(map[string]any); ok {
		result := make([]string, 0, len(m))
		for key := range m {
			result = append(result, key)
		}
		// sort is needed because iter over map gives random order
		slices.Sort(result)
		return result, nil
	}

	return []string{}, nil
}
