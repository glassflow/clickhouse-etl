package transformer

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
