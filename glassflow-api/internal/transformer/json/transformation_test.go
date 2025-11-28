package json

import (
	"testing"
)

func TestTransformer_Transform(t *testing.T) {
	tests := []struct {
		name            string
		transformations []TransformationConfig
		input           string
		expected        string
		wantErr         bool
	}{
		{
			name: "concat first_name and last_name",
			transformations: []TransformationConfig{
				{
					Expr:         `concat(first_name, " ", last_name)`,
					OutputColumn: "name",
					Type:         "string",
				},
				{
					Expr:         "age",
					OutputColumn: "age",
					Type:         "int",
				},
			},
			input:    `{"first_name":"Nick","last_name":"N","age":10}`,
			expected: `{"age":10,"name":"Nick N"}`,
			wantErr:  false,
		},
		{
			name: "query param extraction and path type",
			transformations: []TransformationConfig{
				{
					Expr:         `getQueryParam(request_query, "cid")`,
					OutputColumn: "client_id",
					Type:         "string",
				},
				{
					Expr:         `extractPathType(path)`,
					OutputColumn: "request_type",
					Type:         "string",
				},
				{
					Expr:         `parseUserAgent(http_user_agent, "device")`,
					OutputColumn: "device_type",
					Type:         "string",
				},
			},
			input:    `{"request_query":"cid=123456&sid=789","path":"/g/collect","http_user_agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)"}`,
			expected: `{"client_id":"123456","device_type":"Mobile","request_type":"collect"}`,
			wantErr:  false,
		},
		{
			name: "waterfall logic and nested params",
			transformations: []TransformationConfig{
				{
					Expr:         `waterfall([getQueryParam(request_query, "cu"), getNestedParam(request_query, "ep.currency"), "EUR"])`,
					OutputColumn: "currency",
					Type:         "string",
				},
				{
					Expr:         `getNestedParam(request_query, "ep.value")`,
					OutputColumn: "value",
					Type:         "string",
				},
				{
					Expr:         `urlDecode(getQueryParam(request_query, "dt"))`,
					OutputColumn: "page_title",
					Type:         "string",
				},
			},
			input:    `{"request_query":"cu=USD&ep.value=29.99&dt=Test%20Page"}`,
			expected: `{"currency":"USD","page_title":"Test Page","value":"29.99"}`,
			wantErr:  false,
		},
		{
			name: "comprehensive test with all custom functions",
			transformations: []TransformationConfig{
				{
					Expr:         `getQueryParam(request_query, "cid")`,
					OutputColumn: "client_id",
					Type:         "string",
				},
				{
					Expr:         `getQueryParam(request_query, "sct")`,
					OutputColumn: "session_count",
					Type:         "int",
				},
				{
					Expr:         `getNestedParam(request_query, "ep.event_id")`,
					OutputColumn: "event_id",
					Type:         "string",
				},
				{
					Expr:         `extractPathType(path)`,
					OutputColumn: "request_type",
					Type:         "string",
				},
				{
					Expr:         `parseUserAgent(http_user_agent, "device")`,
					OutputColumn: "device",
					Type:         "string",
				},
				{
					Expr:         `parseUserAgent(http_user_agent, "browser")`,
					OutputColumn: "browser",
					Type:         "string",
				},
				{
					Expr:         `parseUserAgent(http_user_agent, "os")`,
					OutputColumn: "os",
					Type:         "string",
				},
				{
					Expr:         `urlDecode(getQueryParam(request_query, "dt"))`,
					OutputColumn: "page_title",
					Type:         "string",
				},
				{
					Expr:         `waterfall([getQueryParam(request_query, "cu"), "EUR"])`,
					OutputColumn: "currency",
					Type:         "string",
				},
				{
					Expr:         `hasKeyPrefix(parseQuery(request_query), ["ep.user_data"]) ? 1 : 0`,
					OutputColumn: "has_enhanced_conversions",
					Type:         "int",
				},
				{
					Expr:         `hasAnyKey(parseQuery(request_query), ["pr1", "ep.items"]) ? 1 : 0`,
					OutputColumn: "has_ecommerce",
					Type:         "int",
				},
				{
					Expr:         `toDate(parseISO8601(_x40timestamp))`,
					OutputColumn: "date",
					Type:         "string",
				},
			},
			input:    `{"_x40timestamp":"2025-10-20 08:25:44.068833","path":"/g/collect","request_query":"cid=123456&sct=5&ep.event_id=999&dt=Test%20Page&cu=USD&ep.user_data.email=test@example.com&pr1=item1","http_user_agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15"}`,
			expected: `{"browser":"Unknown","client_id":"123456","currency":"USD","date":"2025-10-20","device":"Mobile","event_id":"999","has_ecommerce":1,"has_enhanced_conversions":1,"os":"macOS","page_title":"Test Page","request_type":"collect","session_count":5}`,
			wantErr:  false,
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

			output := string(outputBytes)
			if output != tt.expected {
				t.Errorf("Transform() output = %s, want %s", output, tt.expected)
			}
		})
	}
}
