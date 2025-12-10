package json

import (
	"encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestTransformer_Transform(t *testing.T) {
	tests := []struct {
		name            string
		transformations []models.Transform
		input           string
		expected        string
		wantErr         bool
	}{
		{
			name: "complete mapping with all field types",
			transformations: []models.Transform{
				{
					Expression: `parseISO8601(_x40timestamp)`,
					OutputName: "timestamp",
					OutputType: "int64",
				},
				{
					Expression: `toDate(parseISO8601(_x40timestamp))`,
					OutputName: "date",
					OutputType: "string",
				},
				{
					Expression: `container_id`,
					OutputName: "product_id",
					OutputType: "string",
				},
				{
					Expression: `request_id`,
					OutputName: "nginx_event_id",
					OutputType: "string",
				},
				{
					Expression: `getQueryParam(request_query, "cid")`,
					OutputName: "client_id",
					OutputType: "string",
				},
				{
					Expression: `getQueryParam(request_query, "sid")`,
					OutputName: "session_id",
					OutputType: "string",
				},
				{
					Expression: `toInt(getQueryParam(request_query, "sct")) != 0 ? toInt(getQueryParam(request_query, "sct")) : 1`,
					OutputName: "session_number",
					OutputType: "int",
				},
				{
					Expression: `getQueryParam(request_query, "seg")`,
					OutputName: "is_session_engaged",
					OutputType: "string",
				},
				{
					Expression: `toInt(getQueryParam(request_query, "_et")) != 0 ? toInt(getQueryParam(request_query, "_et")) : 0`,
					OutputName: "engagement_time_msec",
					OutputType: "int",
				},
				{
					Expression: `getNestedParam(request_query, "ep.event_id")`,
					OutputName: "event_id",
					OutputType: "string",
				},
				{
					Expression: `getQueryParam(request_query, "en")`,
					OutputName: "event_name",
					OutputType: "string",
				},
				{
					Expression: `extractPathType(path)`,
					OutputName: "event_request_type",
					OutputType: "string",
				},
				{
					Expression: `urlDecode(getQueryParam(request_query, "dt"))`,
					OutputName: "page_title",
					OutputType: "string",
				},
				{
					Expression: `waterfall([getNestedParam(request_query, "ep.value"), getNestedParam(request_query, "epn.value")])`,
					OutputName: "purchase_value",
					OutputType: "string",
				},
				{
					Expression: `waterfall([getQueryParam(request_query, "cu"), getNestedParam(request_query, "ep.currency"), "EUR"])`,
					OutputName: "purchase_currency",
					OutputType: "string",
				},
				{
					Expression: `hasKeyPrefix(parseQuery(request_query), ["ep.user_data", "ep.email"]) ? 1 : 0`,
					OutputName: "has_enhanced_conversions",
					OutputType: "int",
				},
				{
					Expression: `hasAnyKey(parseQuery(request_query), ["pr1", "ep.items", "ep.transaction_id"]) ? 1 : 0`,
					OutputName: "has_ecommerce_data",
					OutputType: "int",
				},
				{
					Expression: `parseUserAgent(http_user_agent, "device")`,
					OutputName: "device_type",
					OutputType: "string",
				},
				{
					Expression: `parseUserAgent(http_user_agent, "browser")`,
					OutputName: "browser_name",
					OutputType: "string",
				},
				{
					Expression: `parseUserAgent(http_user_agent, "os")`,
					OutputName: "os_name",
					OutputType: "string",
				},
				{
					Expression: `status`,
					OutputName: "http_status",
					OutputType: "string",
				},
				{
					Expression: `toFloat(request_time) * 1000000`,
					OutputName: "request_time_usec",
					OutputType: "float64",
				},
			},
			input: `
{
  "_x40timestamp": "2025-10-20 08:25:44.068833",
  "container_id": "lowzohumkv",
  "request_id": "63e4a61d12911f99fc19b18a99f5e850",
  "path": "/g/collect",
  "request_query": "cid=220153569.1760948734&sid=1760948734&sct=1&seg=1&_et=7545&en=scroll&ep.event_id=1760948732998.3",
  "http_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "request_time": "0.19",
  "status": "200"
}`,
			expected: `
{
  "browser_name": "Unknown",
  "client_id": "220153569.1760948734",
  "date": "2025-10-20",
  "device_type": "Desktop",
  "engagement_time_msec": 7545,
  "event_id": "1760948732998.3",
  "event_name": "scroll",
  "event_request_type": "collect",
  "has_ecommerce_data": 0,
  "has_enhanced_conversions": 0,
  "http_status": "200",
  "is_session_engaged": "1",
  "nginx_event_id": "63e4a61d12911f99fc19b18a99f5e850",
  "os_name": "Windows",
  "page_title": "",
  "product_id": "lowzohumkv",
  "purchase_currency": "EUR",
  "purchase_value": "",
  "request_time_usec": 190000,
  "session_id": "1760948734",
  "session_number": 1,
  "timestamp": 1760948744
}
`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transformer, err := NewTransformer(tt.transformations)
			if err != nil {
				t.Fatalf("NewTransformer() error = %v", err)
			}

			outputBytes, err := transformer.Transform([]byte(tt.input))
			if (err != nil) != tt.wantErr {
				t.Errorf("Transform() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if tt.wantErr {
				return
			}

			var actual map[string]interface{}
			if err := json.Unmarshal(outputBytes, &actual); err != nil {
				t.Fatalf("Failed to unmarshal actual output: %v", err)
			}

			var expected map[string]interface{}
			if err := json.Unmarshal([]byte(tt.expected), &expected); err != nil {
				t.Fatalf("Failed to unmarshal expected output: %v", err)
			}

			if diff := cmp.Diff(expected, actual); diff != "" {
				t.Errorf("Transform() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
func TestCustomFunctions(t *testing.T) {
	tests := []struct {
		name            string
		transformations []models.Transform
		input           string
		expected        string
	}{
		{
			name: "toString",
			transformations: []models.Transform{
				{
					Expression: `toString(num)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"num":123}`,
			expected: `{"result":"123"}`,
		},
		{
			name: "containsStr",
			transformations: []models.Transform{
				{
					Expression: `containsStr(text, "world")`,
					OutputName: "result",
					OutputType: "bool",
				},
			},
			input:    `{"text":"hello world"}`,
			expected: `{"result":true}`,
		},
		{
			name: "hasPrefix",
			transformations: []models.Transform{
				{
					Expression: `hasPrefix(text, "hello")`,
					OutputName: "result",
					OutputType: "bool",
				},
			},
			input:    `{"text":"hello world"}`,
			expected: `{"result":true}`,
		},
		{
			name: "hasSuffix",
			transformations: []models.Transform{
				{
					Expression: `hasSuffix(text, "world")`,
					OutputName: "result",
					OutputType: "bool",
				},
			},
			input:    `{"text":"hello world"}`,
			expected: `{"result":true}`,
		},
		{
			name: "upper",
			transformations: []models.Transform{
				{
					Expression: `upper(text)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"text":"hello"}`,
			expected: `{"result":"HELLO"}`,
		},
		{
			name: "lower",
			transformations: []models.Transform{
				{
					Expression: `lower(text)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"text":"HELLO"}`,
			expected: `{"result":"hello"}`,
		},
		{
			name: "trim",
			transformations: []models.Transform{
				{
					Expression: `trim(text)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"text":"  hello  "}`,
			expected: `{"result":"hello"}`,
		},
		{
			name: "split",
			transformations: []models.Transform{
				{
					Expression: `split(text, ",")`,
					OutputName: "result",
					OutputType: "[]string",
				},
			},
			input:    `{"text":"a,b,c"}`,
			expected: `{"result":["a","b","c"]}`,
		},
		{
			name: "join",
			transformations: []models.Transform{
				{
					Expression: `join(items, ",")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"items":["a","b","c"]}`,
			expected: `{"result":"a,b,c"}`,
		},
		{
			name: "replace",
			transformations: []models.Transform{
				{
					Expression: `replace(text, "world", "universe")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"text":"hello world"}`,
			expected: `{"result":"hello universe"}`,
		},
		{
			name: "toInt - valid",
			transformations: []models.Transform{
				{
					Expression: `toInt(text)`,
					OutputName: "result",
					OutputType: "int",
				},
			},
			input:    `{"text":"123"}`,
			expected: `{"result":123}`,
		},
		{
			name: "toInt - invalid",
			transformations: []models.Transform{
				{
					Expression: `toInt(text)`,
					OutputName: "result",
					OutputType: "int",
				},
			},
			input:    `{"text":"abc"}`,
			expected: `{"result":0}`,
		},
		{
			name: "toFloat - valid",
			transformations: []models.Transform{
				{
					Expression: `toFloat(text)`,
					OutputName: "result",
					OutputType: "float64",
				},
			},
			input:    `{"text":"123.45"}`,
			expected: `{"result":123.45}`,
		},
		{
			name: "toFloat - invalid",
			transformations: []models.Transform{
				{
					Expression: `toFloat(text)`,
					OutputName: "result",
					OutputType: "float64",
				},
			},
			input:    `{"text":"abc"}`,
			expected: `{"result":0}`,
		},
		{
			name: "toDate - from unix timestamp int",
			transformations: []models.Transform{
				{
					Expression: `toDate(timestamp)`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"timestamp":1729411544}`,
			expected: `{"result":"2024-10-20"}`,
		},
		{
			name: "toDate - from unix timestamp int64",
			transformations: []models.Transform{
				{
					Expression: `toDate(parseISO8601(ts))`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ts":"2024-10-20 08:25:44.068833"}`,
			expected: `{"result":"2024-10-20"}`,
		},
		{
			name: "parseUserAgent - device Mobile",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "device")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"}`,
			expected: `{"result":"Mobile"}`,
		},
		{
			name: "parseUserAgent - device Tablet",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "device")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)"}`,
			expected: `{"result":"Tablet"}`,
		},
		{
			name: "parseUserAgent - device Desktop",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "device")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}`,
			expected: `{"result":"Desktop"}`,
		},
		{
			name: "parseUserAgent - browser Chrome",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "browser")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}`,
			expected: `{"result":"Chrome"}`,
		},
		{
			name: "parseUserAgent - browser Firefox",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "browser")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0"}`,
			expected: `{"result":"Firefox"}`,
		},
		{
			name: "parseUserAgent - browser Safari",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "browser")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15"}`,
			expected: `{"result":"Safari"}`,
		},
		{
			name: "parseUserAgent - browser Edge",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "browser")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0"}`,
			expected: `{"result":"Edge"}`,
		},
		{
			name: "parseUserAgent - os Windows",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "os")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}`,
			expected: `{"result":"Windows"}`,
		},
		{
			name: "parseUserAgent - os macOS",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "os")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}`,
			expected: `{"result":"macOS"}`,
		},
		{
			name: "parseUserAgent - os iOS",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "os")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"}`,
			expected: `{"result":"iOS"}`,
		},
		{
			name: "parseUserAgent - os Android",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "os")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (Linux; Android 11; SM-G991B)"}`,
			expected: `{"result":"Android"}`,
		},
		{
			name: "parseUserAgent - os Linux",
			transformations: []models.Transform{
				{
					Expression: `parseUserAgent(ua, "os")`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"ua":"Mozilla/5.0 (X11; Linux x86_64)"}`,
			expected: `{"result":"Linux"}`,
		},
		{
			name: "keys",
			transformations: []models.Transform{
				{
					Expression: `keys(parseQuery(query))`,
					OutputName: "result",
					OutputType: "[]string",
				},
			},
			input:    `{"query":"a=1&b=2&c=3"}`,
			expected: `{"result":["a","b","c"]}`,
		},
		{
			name: "parseQuery - single key",
			transformations: []models.Transform{
				{
					Expression: `parseQuery(query)["a"]`,
					OutputName: "result",
					OutputType: "string",
				},
			},
			input:    `{"query":"a=1&b=2&c=3"}`,
			expected: `{"result":"1"}`,
		},
		{
			name: "parseQuery - nested params",
			transformations: []models.Transform{
				{
					Expression: `parseQuery(query)["ep.event_id"]`,
					OutputName: "event_id",
					OutputType: "string",
				},
				{
					Expression: `parseQuery(query)["ep.value"]`,
					OutputName: "value",
					OutputType: "string",
				},
			},
			input:    `{"query":"ep.event_id=123&ep.value=99.99"}`,
			expected: `{"event_id":"123","value":"99.99"}`,
		},
		{
			name: "len of array",
			transformations: []models.Transform{
				{
					Expression: `len(items)`,
					OutputName: "result",
					OutputType: "int",
				},
			},
			input:    `{"items":["a","b","c"]}`,
			expected: `{"result":3}`,
		},
		{
			name: "passthrough - direct field access",
			transformations: []models.Transform{
				{
					Expression: `name`,
					OutputName: "name",
					OutputType: "string",
				},
			},
			input:    `{"name":"John","age":30}`,
			expected: `{"name":"John"}`,
		},
		{
			name: "is_image",
			transformations: []models.Transform{
				{
					Expression: `hasSuffix(filename, ".png") || hasSuffix(filename, ".jpg") ? 1 : 0`,
					OutputName: "is_image",
					OutputType: "int",
				},
			},
			input:    `{"filename":"photo.jpg"}`,
			expected: `{"is_image":1}`,
		},
		{
			name: "is_image bool",
			transformations: []models.Transform{
				{
					Expression: `hasSuffix(filename, ".png") || hasSuffix(filename, ".jpg") ? true : false`,
					OutputName: "is_image",
					OutputType: "bool",
				},
			},
			input:    `{"filename":"photo.jpg"}`,
			expected: `{"is_image":true}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transformer, err := NewTransformer(tt.transformations)
			if err != nil {
				t.Fatalf("NewTransformer() error = %v", err)
			}

			outputBytes, err := transformer.Transform([]byte(tt.input))
			if err != nil {
				t.Errorf("Transform() error = %v", err)
				return
			}

			output := string(outputBytes)
			diff := cmp.Diff(output, tt.expected)
			if diff != "" {
				t.Errorf("Transform() %s", diff)
			}
		})
	}
}

func TestParseQuery(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		expected map[string]any
	}{
		{
			name:  "simple query",
			query: "a=1&b=2&c=3",
			expected: map[string]any{
				"a": "1",
				"b": "2",
				"c": "3",
			},
		},
		{
			name:  "nested params",
			query: "ep.event_id=123&ep.value=99.99",
			expected: map[string]any{
				"ep.event_id": "123",
				"ep.value":    "99.99",
			},
		},
		{
			name:     "empty query",
			query:    "",
			expected: map[string]any{},
		},
		{
			name:  "single param",
			query: "key=value",
			expected: map[string]any{
				"key": "value",
			},
		},
		{
			name:  "url encoded values",
			query: "name=John%20Doe&email=test%40example.com",
			expected: map[string]any{
				"name":  "John Doe",
				"email": "test@example.com",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseQueryString(tt.query)
			if err != nil {
				t.Fatalf("parseQueryString() error = %v", err)
			}

			resultMap, ok := result.(map[string]any)
			if !ok {
				t.Fatalf("parseQueryString() returned non-map type: %T", result)
			}

			diff := cmp.Diff(resultMap, tt.expected)
			if diff != "" {
				t.Errorf("parseQueryString() mismatch (-got +want):\n%s", diff)
			}
		})
	}
}
