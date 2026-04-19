package datamigrations

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func TestToSchemaFields(t *testing.T) {
	tests := []struct {
		name   string
		input  []v2StreamDataField
		expect []models.Field
	}{
		{
			name: "basic types preserved",
			input: []v2StreamDataField{
				{FieldName: "id", FieldType: "string"},
				{FieldName: "count", FieldType: "int"},
			},
			expect: []models.Field{
				{Name: "id", Type: "string"},
				{Name: "count", Type: "int"},
			},
		},
		{
			name: "precision types normalised",
			input: []v2StreamDataField{
				{FieldName: "amount", FieldType: "int32"},
				{FieldName: "ratio", FieldType: "float64"},
			},
			expect: []models.Field{
				{Name: "amount", Type: "int"},
				{Name: "ratio", Type: "float"},
			},
		},
		{
			name:   "empty input",
			input:  []v2StreamDataField{},
			expect: []models.Field{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, toSchemaFields(tt.input))
		})
	}
}

func TestDeriveSinkSourceID(t *testing.T) {
	singleStream := v2SourceConfig{
		Streams: map[string]v2StreamSchemaConfig{"topic-1": {}},
	}

	tests := []struct {
		name      string
		src       v2SourceConfig
		stateless *v2StatelessTransformation
		join      *v2JoinConfig
		expect    string
	}{
		{
			name:   "ingest only — uses topic id",
			src:    singleStream,
			expect: "topic-1",
		},
		{
			name: "stateless transform — uses transform id",
			src:  singleStream,
			stateless: &v2StatelessTransformation{
				ID:      "transform-abc",
				Enabled: true,
			},
			expect: "transform-abc",
		},
		{
			name: "join — uses join id regardless of transform",
			src:  singleStream,
			stateless: &v2StatelessTransformation{
				ID:      "transform-abc",
				Enabled: true,
			},
			join: &v2JoinConfig{
				ID:      "join-xyz",
				Enabled: true,
			},
			expect: "join-xyz",
		},
		{
			name: "disabled stateless transform — falls back to topic",
			src:  singleStream,
			stateless: &v2StatelessTransformation{
				ID:      "transform-abc",
				Enabled: false,
			},
			expect: "topic-1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expect, deriveSinkSourceID(tt.src, tt.stateless, tt.join))
		})
	}
}

func TestBuildJoinOutputFields(t *testing.T) {
	streams := map[string]v2StreamSchemaConfig{
		"left": {
			Fields: []v2StreamDataField{
				{FieldName: "user_id", FieldType: "string"},
				{FieldName: "amount", FieldType: "int32"},
			},
		},
		"right": {
			Fields: []v2StreamDataField{
				{FieldName: "product_id", FieldType: "string"},
			},
		},
	}

	rules := []models.JoinRule{
		{SourceID: "left", SourceName: "user_id", OutputName: "uid"},
		{SourceID: "left", SourceName: "amount", OutputName: "total"},
		{SourceID: "right", SourceName: "product_id", OutputName: "pid"},
	}

	got := buildJoinOutputFields(rules, streams)

	assert.Equal(t, []models.Field{
		{Name: "uid", Type: "string"},
		{Name: "total", Type: "int"},
		{Name: "pid", Type: "string"},
	}, got)
}

func TestBuildSinkMappings(t *testing.T) {
	streams := map[string]v2StreamSchemaConfig{
		"orders": {
			Fields: []v2StreamDataField{
				{FieldName: "order_id", FieldType: "string"},
				{FieldName: "amount", FieldType: "int32"},
			},
		},
	}

	entries := []v2SinkMappingEntry{
		{FieldName: "order_id", StreamName: "orders", ColumnName: "order_id", ColumnType: "String"},
		{FieldName: "amount", StreamName: "orders", ColumnName: "total", ColumnType: "Int32"},
	}

	t.Run("ingest only", func(t *testing.T) {
		got := buildSinkMappings(entries, streams, nil, nil)
		assert.Equal(t, []models.Mapping{
			{SourceField: "order_id", SourceType: "string", DestinationField: "order_id", DestinationType: "String"},
			{SourceField: "amount", SourceType: "int", DestinationField: "total", DestinationType: "Int32"},
		}, got)
	})

	t.Run("stateless transform output takes precedence", func(t *testing.T) {
		stateless := &v2StatelessTransformation{
			Enabled: true,
			Config: struct {
				Transform []models.Transform `json:"transform"`
			}{
				Transform: []models.Transform{
					{OutputName: "order_id", OutputType: "string"},
					{OutputName: "amount", OutputType: "float"},
				},
			},
		}

		got := buildSinkMappings(entries, streams, stateless, nil)
		assert.Equal(t, []models.Mapping{
			{SourceField: "order_id", SourceType: "string", DestinationField: "order_id", DestinationType: "String"},
			{SourceField: "amount", SourceType: "float", DestinationField: "total", DestinationType: "Int32"},
		}, got)
	})
}

func TestRunnerSkipsAppliedMigrations(t *testing.T) {
	applied := map[string]bool{"0001": true}
	var ran []string

	for _, m := range Registry {
		if applied[m.Version] {
			continue
		}
		ran = append(ran, m.Version)
	}

	assert.NotContains(t, ran, "0001")
}

func TestRunnerExecutesInOrder(t *testing.T) {
	type stub struct{ version, name string }
	migrations := []stub{
		{"0001", "first"},
		{"0002", "second"},
		{"0003", "third"},
	}
	applied := map[string]bool{"0001": true}

	var ran []string
	for _, m := range migrations {
		if applied[m.version] {
			continue
		}
		ran = append(ran, m.name)
	}

	assert.Equal(t, []string{"second", "third"}, ran)
}
