package json

import (
	"testing"
)

func TestFilter_Satisfies(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		jsonData   string
		want       bool
		wantErr    bool
	}{
		{
			name:       "simple string equality - match",
			expression: `name == "John"`,
			jsonData:   `{"name": "John"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "simple string equality - no match",
			expression: `name == "John"`,
			jsonData:   `{"name": "Jane"}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "integer comparison - greater than true",
			expression: "age > 18",
			jsonData:   `{"age": 25}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "integer comparison - greater than false",
			expression: "age > 18",
			jsonData:   `{"age": 15}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "boolean field - true",
			expression: "is_active == true",
			jsonData:   `{"is_active": true}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "boolean field - false",
			expression: "is_active == true",
			jsonData:   `{"is_active": false}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "multiple fields with AND - both true",
			expression: `age > 18 and name == "John"`,
			jsonData:   `{"age": 25, "name": "John"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "multiple fields with AND - one false",
			expression: `age > 18 and name == "John"`,
			jsonData:   `{"age": 25, "name": "Jane"}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "multiple fields with OR - one true",
			expression: `age > 18 or name == "John"`,
			jsonData:   `{"age": 15, "name": "John"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "multiple fields with OR - both false",
			expression: `age > 18 or name == "John"`,
			jsonData:   `{"age": 15, "name": "Jane"}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "float comparison - greater than or equal",
			expression: "price >= 100.5",
			jsonData:   `{"price": 100.5}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "float comparison - less than",
			expression: "price >= 100.5",
			jsonData:   `{"price": 99.99}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "complex expression with parentheses - true",
			expression: "(age > 18 and age < 65) or is_student == true",
			jsonData:   `{"age": 25, "is_student": false}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "complex expression with parentheses - false",
			expression: "(age > 18 and age < 65) or is_student == true",
			jsonData:   `{"age": 70, "is_student": false}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "nested JSON field - age comparison true",
			expression: `user.age > 18`,
			jsonData:   `{"user": {"age": 25}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "nested JSON field - age comparison false",
			expression: `user.age > 18`,
			jsonData:   `{"user": {"age": 15}}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "nested JSON field - string equality true",
			expression: `user.name == "John"`,
			jsonData:   `{"user": {"name": "John"}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "nested JSON field - string equality false",
			expression: `user.name == "John"`,
			jsonData:   `{"user": {"name": "Jane"}}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "deeply nested field - three levels",
			expression: `company.department.manager == "Alice"`,
			jsonData:   `{"company": {"department": {"manager": "Alice"}}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "nested field with multiple conditions",
			expression: `user.age > 18 and user.active == true`,
			jsonData:   `{"user": {"age": 25, "active": true}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "array field access",
			expression: "tags[0] == 1",
			jsonData:   `{"tags": [1, 2, 3]}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "always true expression",
			expression: "true",
			jsonData:   `{"age": 25}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "always false expression",
			expression: "false",
			jsonData:   `{"age": 25}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "invalid JSON",
			expression: "age > 18",
			jsonData:   `{invalid json}`,
			want:       false,
			wantErr:    true,
		},
		{
			name:       "expression returns non-boolean",
			expression: "age + 5",
			jsonData:   `{"age": 25}`,
			want:       false,
			wantErr:    true,
		},
		{
			name:       "missing field in JSON",
			expression: "age > 18",
			jsonData:   `{"name": "John"}`,
			want:       false,
			wantErr:    true,
		},
		{
			name:       "empty JSON object",
			expression: "true",
			jsonData:   `{}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "null value comparison",
			expression: "name == nil",
			jsonData:   `{"name": null}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "not equal operator",
			expression: `name != "John"`,
			jsonData:   `{"name": "Jane"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "less than or equal",
			expression: "age <= 18",
			jsonData:   `{"age": 18}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "in operator with array",
			expression: `status in ["active", "pending"]`,
			jsonData:   `{"status": "active"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "not in operator with array",
			expression: `status not in ["active", "pending"]`,
			jsonData:   `{"status": "completed"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NULL - field is null",
			expression: "name == nil",
			jsonData:   `{"name": null}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NULL - field is not null",
			expression: "name == nil",
			jsonData:   `{"name": "John"}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "IS NOT NULL - field is not null",
			expression: "name != nil",
			jsonData:   `{"name": "John"}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NOT NULL - field is null",
			expression: "name != nil",
			jsonData:   `{"name": null}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "IS NULL with nested field - field is null",
			expression: "user.email == nil",
			jsonData:   `{"user": {"email": null}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NULL with nested field - field is not null",
			expression: "user.email == nil",
			jsonData:   `{"user": {"email": "test@example.com"}}`,
			want:       false,
			wantErr:    false,
		},
		{
			name:       "IS NOT NULL with nested field - field is not null",
			expression: "user.email != nil",
			jsonData:   `{"user": {"email": "test@example.com"}}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NULL combined with AND - both conditions true",
			expression: "age > 18 and email == nil",
			jsonData:   `{"age": 25, "email": null}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NULL combined with OR - one condition true",
			expression: "age < 18 or email == nil",
			jsonData:   `{"age": 25, "email": null}`,
			want:       true,
			wantErr:    false,
		},
		{
			name:       "IS NOT NULL combined with other conditions",
			expression: `name != nil and age > 18`,
			jsonData:   `{"name": "John", "age": 25}`,
			want:       true,
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter, err := New(tt.expression)
			if err != nil {
				t.Fatalf("New() error = %v", err)
			}

			got, err := filter.Matches([]byte(tt.jsonData))
			if (err != nil) != tt.wantErr {
				t.Errorf("Filter.Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("Filter.Matches() = %v, want %v", got, tt.want)
			}
		})
	}
}
