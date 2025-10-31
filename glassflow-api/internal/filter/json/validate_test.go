package json

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestValidateFilter(t *testing.T) {
	type args struct {
		expression string
		fields     []models.StreamDataField
	}
	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "empty expression",
			args: args{
				expression: "",
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
				},
			},
			wantErr: true,
		},
		{
			name: "valid expression with string field",
			args: args{
				expression: `name == "John"`,
				fields: []models.StreamDataField{
					{FieldName: "name", FieldType: "string"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with int field",
			args: args{
				expression: "age > 18",
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with bool field",
			args: args{
				expression: "is_active == true",
				fields: []models.StreamDataField{
					{FieldName: "is_active", FieldType: "bool"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with multiple fields",
			args: args{
				expression: `age > 18 && name == "John"`,
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
					{FieldName: "name", FieldType: "string"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with float field",
			args: args{
				expression: "price >= 100.5",
				fields: []models.StreamDataField{
					{FieldName: "price", FieldType: "float64"},
				},
			},
			wantErr: false,
		},
		{
			name: "invalid syntax in expression",
			args: args{
				expression: "age >>>> 18",
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
				},
			},
			wantErr: true,
		},
		{
			name: "expression with undefined field",
			args: args{
				expression: "unknown_field == 10",
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
				},
			},
			wantErr: true,
		},
		{
			name: "valid complex expression with logical operators",
			args: args{
				expression: "(age > 18 && age < 65) || is_student == true",
				fields: []models.StreamDataField{
					{FieldName: "age", FieldType: "int"},
					{FieldName: "is_student", FieldType: "bool"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with uint field",
			args: args{
				expression: "count > 0",
				fields: []models.StreamDataField{
					{FieldName: "count", FieldType: "uint64"},
				},
			},
			wantErr: false,
		},
		{
			name: "valid expression with int8 field",
			args: args{
				expression: "level >= 1",
				fields: []models.StreamDataField{
					{FieldName: "level", FieldType: "int8"},
				},
			},
			wantErr: false,
		},
		{
			name: "unsupported field type",
			args: args{
				expression: "data != nil",
				fields: []models.StreamDataField{
					{FieldName: "data", FieldType: "unknown_type"},
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := ValidateFilter(tt.args.expression, tt.args.fields); (err != nil) != tt.wantErr {
				t.Errorf("ValidateFilter() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
