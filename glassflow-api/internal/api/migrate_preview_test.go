package api

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

var baseConnectionParams = &sourceConnectionParamsV2{
	Brokers:       []string{"broker:9092"},
	SASLMechanism: "PLAIN",
	SASLProtocol:  "SASL_PLAINTEXT",
	SASLUsername:  "user",
	SASLPassword:  "pass",
}

var baseSinkParams = sinkConnectionParamsV2{
	Host:     "ch-host",
	Port:     "9000",
	HttpPort: "8123",
	Database: "db",
	Username: "default",
	Password: "pass",
	Secure:   false,
}

func TestConvertV2ToV3_IngestOnly(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-1",
		Name:       "Ingest Only",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics: []kafkaTopicV2{
				{ID: "orders", Topic: "orders-topic"},
			},
		},
		Schema: schemaV2{
			Fields: []schemaFieldV2{
				{SourceID: "orders", Name: "id", Type: "string", ColumnName: "id", ColumnType: "String"},
				{SourceID: "orders", Name: "amount", Type: "float", ColumnName: "amount", ColumnType: "Float64"},
			},
		},
		Sink: clickhouseSinkV2{
			Kind:             "clickhouse",
			ConnectionParams: baseSinkParams,
			Table:            "orders_table",
			MaxBatchSize:     1000,
		},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if out.Version != "v3" {
		t.Errorf("version = %q, want v3", out.Version)
	}
	if out.PipelineID != "pipe-1" {
		t.Errorf("pipeline_id = %q, want pipe-1", out.PipelineID)
	}
	if len(out.Sources) != 1 {
		t.Fatalf("len(sources) = %d, want 1", len(out.Sources))
	}
	src := out.Sources[0]
	if src.SourceID != "orders" {
		t.Errorf("source_id = %q, want orders", src.SourceID)
	}
	if src.Topic != "orders-topic" {
		t.Errorf("topic = %q, want orders-topic", src.Topic)
	}
	if len(src.SchemaFields) != 2 {
		t.Errorf("len(schema_fields) = %d, want 2", len(src.SchemaFields))
	}
	if len(out.Transforms) != 0 {
		t.Errorf("unexpected transforms: %v", out.Transforms)
	}
	if out.Join != nil {
		t.Errorf("unexpected join")
	}
	if len(out.Sink.Mapping) != 2 {
		t.Errorf("len(sink.mapping) = %d, want 2", len(out.Sink.Mapping))
	}
}

func TestConvertV2ToV3_TopicIDFallback(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-2",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics: []kafkaTopicV2{
				{ID: "", Topic: "events-topic"}, // empty ID — should use topic name
			},
		},
		Schema: schemaV2{
			Fields: []schemaFieldV2{
				{SourceID: "events-topic", Name: "ts", Type: "int", ColumnName: "ts", ColumnType: "Int64"},
			},
		},
		Sink: clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Sources[0].SourceID != "events-topic" {
		t.Errorf("source_id = %q, want events-topic", out.Sources[0].SourceID)
	}
	if len(out.Sources[0].SchemaFields) != 1 {
		t.Errorf("schema_fields not matched by topic name fallback")
	}
}

func TestConvertV2ToV3_DedupPerTopic(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-3",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics: []kafkaTopicV2{
				{
					ID:    "orders",
					Topic: "orders-topic",
					Deduplication: dedupConfigV2{
						Enabled: true,
						Key:     "order_id",
						Window:  models.JSONDuration{},
					},
				},
			},
		},
		Schema: schemaV2{Fields: []schemaFieldV2{{SourceID: "orders", Name: "order_id", Type: "string", ColumnName: "order_id", ColumnType: "String"}}},
		Sink:   clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Transforms) != 1 {
		t.Fatalf("len(transforms) = %d, want 1", len(out.Transforms))
	}
	tr := out.Transforms[0]
	if tr.Type != transformTypeDedup {
		t.Errorf("transform type = %q, want dedup", tr.Type)
	}
	if tr.SourceID != "orders" {
		t.Errorf("transform source_id = %q, want orders", tr.SourceID)
	}
	if tr.Config.Key != "order_id" {
		t.Errorf("transform key = %q, want order_id", tr.Config.Key)
	}
}

func TestConvertV2ToV3_Filter(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-4",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics:           []kafkaTopicV2{{ID: "src", Topic: "t"}},
		},
		Filter: pipelineFilterV2{Enabled: true, Expression: "amount > 0"},
		Schema: schemaV2{Fields: []schemaFieldV2{{SourceID: "src", Name: "amount", Type: "float", ColumnName: "amount", ColumnType: "Float64"}}},
		Sink:   clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Transforms) != 1 || out.Transforms[0].Type != transformTypeFilter {
		t.Fatalf("expected 1 filter transform, got %v", out.Transforms)
	}
	if out.Transforms[0].Config.Expression != "amount > 0" {
		t.Errorf("expression = %q, want 'amount > 0'", out.Transforms[0].Config.Expression)
	}
}

func TestConvertV2ToV3_StatelessTransformation(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-5",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics:           []kafkaTopicV2{{ID: "src", Topic: "t"}},
		},
		StatelessTransformation: models.StatelessTransformation{
			Enabled:  true,
			SourceID: "src",
			Config: models.StatelessTransformationsConfig{
				Transform: []models.Transform{{Expression: "upper(name)", OutputName: "name_upper", OutputType: "string"}},
			},
		},
		Schema: schemaV2{Fields: []schemaFieldV2{{SourceID: "src", Name: "name", Type: "string", ColumnName: "name_upper", ColumnType: "String"}}},
		Sink:   clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Transforms) != 1 || out.Transforms[0].Type != transformTypeStateless {
		t.Fatalf("expected 1 stateless transform, got %v", out.Transforms)
	}
	if len(out.Transforms[0].Config.Transforms) != 1 {
		t.Errorf("expected 1 transform rule")
	}
}

func TestConvertV2ToV3_Join(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-6",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics: []kafkaTopicV2{
				{ID: "orders", Topic: "orders-topic"},
				{ID: "users", Topic: "users-topic"},
			},
		},
		Join: pipelineJoinV2{
			Enabled: true,
			Kind:    "temporal",
			Sources: []joinSourceV2{
				{SourceID: "orders", Key: "customer_id", Window: models.JSONDuration{}, Orientation: "left"},
				{SourceID: "users", Key: "user_id", Window: models.JSONDuration{}, Orientation: "right"},
			},
		},
		Schema: schemaV2{
			Fields: []schemaFieldV2{
				{SourceID: "orders", Name: "order_id", Type: "string", ColumnName: "ORDER_ID", ColumnType: "String"},
				{SourceID: "users", Name: "name", Type: "string", ColumnName: "customer_name", ColumnType: "String"},
			},
		},
		Sink: clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if out.Join == nil {
		t.Fatal("expected join, got nil")
	}
	if !out.Join.Enabled {
		t.Error("join.enabled should be true")
	}
	if out.Join.LeftSource.SourceID != "orders" {
		t.Errorf("left source = %q, want orders", out.Join.LeftSource.SourceID)
	}
	if out.Join.RightSource.SourceID != "users" {
		t.Errorf("right source = %q, want users", out.Join.RightSource.SourceID)
	}
	if len(out.Join.OutputFields) != 2 {
		t.Errorf("len(output_fields) = %d, want 2", len(out.Join.OutputFields))
	}
	if out.Join.OutputFields[0].OutputName != "ORDER_ID" {
		t.Errorf("output_name = %q, want ORDER_ID", out.Join.OutputFields[0].OutputName)
	}
}

func TestConvertV2ToV3_SinkMappingFromTableMapping(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-7",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics:           []kafkaTopicV2{{ID: "src", Topic: "t"}},
		},
		Schema: schemaV2{Fields: []schemaFieldV2{{SourceID: "src", Name: "id", Type: "string"}}},
		Sink: clickhouseSinkV2{
			Kind:             "clickhouse",
			ConnectionParams: baseSinkParams,
			Table:            "t",
			TableMapping: []tableMappingEntryV2{
				{Name: "id", ColumnName: "event_id", ColumnType: "String"},
			},
		},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(out.Sink.Mapping) != 1 {
		t.Fatalf("len(mapping) = %d, want 1", len(out.Sink.Mapping))
	}
	if out.Sink.Mapping[0].ColumnName != "event_id" {
		t.Errorf("column_name = %q, want event_id", out.Sink.Mapping[0].ColumnName)
	}
}

func TestConvertV2ToV3_SchemaFieldsDropColumnInfo(t *testing.T) {
	v2 := pipelineJSONv2{
		PipelineID: "pipe-8",
		Source: pipelineSourceV2{
			Type:             "kafka",
			ConnectionParams: baseConnectionParams,
			Topics:           []kafkaTopicV2{{ID: "src", Topic: "t"}},
		},
		Schema: schemaV2{
			Fields: []schemaFieldV2{
				{SourceID: "src", Name: "id", Type: "string", ColumnName: "id", ColumnType: "String"},
			},
		},
		Sink: clickhouseSinkV2{Kind: "clickhouse", ConnectionParams: baseSinkParams, Table: "t"},
	}

	out, err := convertV2ToV3(v2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// schema_fields in sources should only have name+type, no column info
	sf := out.Sources[0].SchemaFields[0]
	if sf.Name != "id" || sf.Type != "string" {
		t.Errorf("schema field = {%q %q}, want {id string}", sf.Name, sf.Type)
	}
}
