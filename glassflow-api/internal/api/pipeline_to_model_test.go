package api

import (
	"encoding/json"
	"testing"
	"time"
)

func mustParseJSON(t *testing.T, jsonStr string) pipelineJSON {
	t.Helper()
	var cfg pipelineJSON
	if err := json.Unmarshal([]byte(jsonStr), &cfg); err != nil {
		t.Fatalf("unmarshal json: %v", err)
	}
	return cfg
}

const kafkaSingleDedupJSON = `{
  "version": "v3",
  "pipeline_id": "my-pipeline",
  "name": "My Pipeline",
  "sources": [
    {
      "type": "kafka",
      "source_id": "orders",
      "connection_params": {
        "brokers": ["localhost:9092"],
        "protocol": "PLAINTEXT",
        "mechanism": "NO_AUTH"
      },
      "topic": "orders",
      "schema_version": "1",
      "schema_fields": [
        {"name": "order_id", "type": "string"},
        {"name": "amount",   "type": "int"}
      ]
    }
  ],
  "transforms": [
    {
      "type": "dedup",
      "source_id": "orders",
      "config": {"key": "order_id", "time_window": "1h"}
    }
  ],
  "sink": {
    "type": "clickhouse",
    "connection_params": {
      "host": "localhost", "port": "9000", "http_port": "8123",
      "database": "db", "username": "default", "password": "secret",
      "secure": false
    },
    "table": "orders",
    "max_batch_size": 1000,
    "max_delay_time": "1s",
    "mapping": [
      {"name": "order_id", "column_name": "order_id", "column_type": "String"},
      {"name": "amount",   "column_name": "amount",   "column_type": "Int32"}
    ]
  }
}`

func TestToModel_KafkaSingleDedup(t *testing.T) {
	cfg := mustParseJSON(t, kafkaSingleDedupJSON)

	model, err := cfg.toModel()
	if err != nil {
		t.Fatalf("toModel: %v", err)
	}

	if model.ID != "my-pipeline" {
		t.Errorf("ID = %q; want my-pipeline", model.ID)
	}
	if !model.SourceType.IsKafka() {
		t.Errorf("SourceType = %q; want kafka", model.SourceType)
	}
	if got := len(model.Ingestor.KafkaTopics); got != 1 {
		t.Fatalf("KafkaTopics len = %d; want 1", got)
	}
	topic := model.Ingestor.KafkaTopics[0]
	if topic.Name != "orders" {
		t.Errorf("topic.Name = %q; want orders", topic.Name)
	}
	if !topic.Deduplication.Enabled || topic.Deduplication.ID != "order_id" {
		t.Errorf("Deduplication = %+v; want enabled with id=order_id", topic.Deduplication)
	}
	if got := topic.Deduplication.Window.Duration(); got != time.Hour {
		t.Errorf("Deduplication.Window = %s; want 1h", got)
	}
	if model.Sink.SourceID != "orders" {
		t.Errorf("Sink.SourceID = %q; want orders", model.Sink.SourceID)
	}
	sv, ok := model.SchemaVersions["orders"]
	if !ok {
		t.Fatal("SchemaVersions missing key orders")
	}
	if len(sv.Fields) != 2 {
		t.Errorf("SchemaVersions[orders].Fields = %d; want 2", len(sv.Fields))
	}
}

const kafkaJoinJSON = `{
  "version": "v3",
  "pipeline_id": "join-pipeline",
  "name": "Join Pipeline",
  "sources": [
    {
      "type": "kafka", "source_id": "orders",
      "connection_params": {"brokers": ["localhost:9092"], "protocol": "PLAINTEXT", "mechanism": "NO_AUTH"},
      "topic": "orders",
      "schema_fields": [
        {"name": "order_id",    "type": "string"},
        {"name": "customer_id", "type": "string"}
      ]
    },
    {
      "type": "kafka", "source_id": "users",
      "connection_params": {"brokers": ["localhost:9092"], "protocol": "PLAINTEXT", "mechanism": "NO_AUTH"},
      "topic": "users",
      "schema_fields": [
        {"name": "user_id", "type": "string"},
        {"name": "email",   "type": "string"}
      ]
    }
  ],
  "join": {
    "enabled": true,
    "type": "temporal",
    "left_source":  {"source_id": "orders", "key": "customer_id", "time_window": "30s"},
    "right_source": {"source_id": "users",  "key": "user_id",     "time_window": "30s"},
    "output_fields": [
      {"source_id": "orders", "name": "order_id", "output_name": "ORDER_ID"},
      {"source_id": "users",  "name": "email"}
    ]
  },
  "sink": {
    "type": "clickhouse",
    "connection_params": {"host": "localhost", "port": "9000", "http_port": "8123", "database": "db", "username": "u", "password": "p", "secure": false},
    "table": "joined",
    "max_batch_size": 500,
    "max_delay_time": "2s",
    "mapping": [
      {"name": "ORDER_ID", "column_name": "order_id", "column_type": "String"},
      {"name": "email",    "column_name": "email",    "column_type": "String"}
    ]
  }
}`

func TestToModel_KafkaJoin(t *testing.T) {
	cfg := mustParseJSON(t, kafkaJoinJSON)
	model, err := cfg.toModel()
	if err != nil {
		t.Fatalf("toModel: %v", err)
	}
	if !model.Join.Enabled {
		t.Fatal("Join.Enabled = false; want true")
	}
	if len(model.Join.Sources) != 2 {
		t.Fatalf("Join.Sources len = %d; want 2", len(model.Join.Sources))
	}
	var sawLeft, sawRight bool
	for _, js := range model.Join.Sources {
		switch js.Orientation {
		case "left":
			sawLeft = true
			if js.SourceID != "orders" || js.JoinKey != "customer_id" {
				t.Errorf("left source = %+v; want orders/customer_id", js)
			}
		case "right":
			sawRight = true
			if js.SourceID != "users" || js.JoinKey != "user_id" {
				t.Errorf("right source = %+v; want users/user_id", js)
			}
		}
	}
	if !sawLeft || !sawRight {
		t.Errorf("missing orientations: left=%v right=%v", sawLeft, sawRight)
	}
	if len(model.Join.Config) != 2 {
		t.Errorf("Join.Config len = %d; want 2", len(model.Join.Config))
	}
	joinID := "join-pipeline-join"
	if _, ok := model.SchemaVersions[joinID]; !ok {
		t.Errorf("SchemaVersions missing join output key %q", joinID)
	}
	if model.Sink.SourceID != joinID {
		t.Errorf("Sink.SourceID = %q; want %q", model.Sink.SourceID, joinID)
	}
}

const otlpJSON = `{
  "version": "v3",
  "pipeline_id": "otlp-pipeline",
  "name": "OTLP Pipeline",
  "sources": [
    {"type": "otlp.traces", "source_id": "traces"}
  ],
  "transforms": [
    {"type": "dedup", "source_id": "traces", "config": {"key": "trace_id", "time_window": "1h"}}
  ],
  "sink": {
    "type": "clickhouse",
    "connection_params": {"host": "localhost", "port": "9000", "http_port": "8123", "database": "db", "username": "u", "password": "p", "secure": false},
    "table": "otlp_traces",
    "max_batch_size": 1000,
    "max_delay_time": "1s",
    "mapping": [
      {"name": "trace_id", "column_name": "trace_id", "column_type": "String"}
    ]
  }
}`

func TestToModel_OTLPTracesDedup(t *testing.T) {
	cfg := mustParseJSON(t, otlpJSON)
	model, err := cfg.toModel()
	if err != nil {
		t.Fatalf("toModel: %v", err)
	}
	if !model.SourceType.IsOTLP() {
		t.Errorf("SourceType = %q; want OTLP", model.SourceType)
	}
	if model.OTLPSource.ID != "traces" {
		t.Errorf("OTLPSource.ID = %q; want traces", model.OTLPSource.ID)
	}
	if !model.OTLPSource.Deduplication.Enabled || model.OTLPSource.Deduplication.ID != "trace_id" {
		t.Errorf("OTLPSource.Deduplication = %+v; want enabled, id=trace_id", model.OTLPSource.Deduplication)
	}
	if len(model.Ingestor.KafkaTopics) != 0 {
		t.Errorf("KafkaTopics should be empty for OTLP pipeline; got %d", len(model.Ingestor.KafkaTopics))
	}
}

func TestToModel_ValidationErrors(t *testing.T) {
	const sinkJSON = `"sink": {"type": "clickhouse", "connection_params": {"host": "h", "port": "9000", "http_port": "8123", "database": "d", "username": "u", "password": "p", "secure": false}, "table": "t", "max_batch_size": 1, "max_delay_time": "1s", "mapping": [{"name": "x", "column_name": "x", "column_type": "String"}]}`
	const kafkaConn = `"connection_params": {"brokers": ["b"], "protocol": "PLAINTEXT", "mechanism": "NO_AUTH"}`

	cases := map[string]string{
		"bad_version": `{
  "version": "v2", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [{"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t"}],
  ` + sinkJSON + `
}`,
		"no_sources": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [],
  ` + sinkJSON + `
}`,
		"duplicate_source_id": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [
    {"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t1"},
    {"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t2"}
  ],
  "join": {"enabled": true, "type": "temporal", "left_source": {"source_id": "a", "key": "k", "time_window": "1s"}, "right_source": {"source_id": "a", "key": "k", "time_window": "1s"}},
  ` + sinkJSON + `
}`,
		"two_kafka_no_join": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [
    {"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t1"},
    {"type": "kafka", "source_id": "b", ` + kafkaConn + `, "topic": "t2"}
  ],
  ` + sinkJSON + `
}`,
		"mixed_kafka_and_otlp": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [
    {"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t1"},
    {"type": "otlp.traces", "source_id": "b"}
  ],
  ` + sinkJSON + `
}`,
		"kafka_conn_params_mismatch": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [
    {"type": "kafka", "source_id": "a", "connection_params": {"brokers": ["b1"], "protocol": "PLAINTEXT", "mechanism": "NO_AUTH"}, "topic": "t1"},
    {"type": "kafka", "source_id": "b", "connection_params": {"brokers": ["b2"], "protocol": "PLAINTEXT", "mechanism": "NO_AUTH"}, "topic": "t2"}
  ],
  "join": {"enabled": true, "type": "temporal", "left_source": {"source_id": "a", "key": "k", "time_window": "1s"}, "right_source": {"source_id": "b", "key": "k", "time_window": "1s"}},
  ` + sinkJSON + `
}`,
		"otlp_with_connection_params": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [{"type": "otlp.traces", "source_id": "t", ` + kafkaConn + `}],
  ` + sinkJSON + `
}`,
		"join_with_unknown_source": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [
    {"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t1"},
    {"type": "kafka", "source_id": "b", ` + kafkaConn + `, "topic": "t2"}
  ],
  "join": {"enabled": true, "type": "temporal", "left_source": {"source_id": "a", "key": "k", "time_window": "1s"}, "right_source": {"source_id": "zzz", "key": "k", "time_window": "1s"}},
  ` + sinkJSON + `
}`,
		"duplicate_dedup_on_source": `{
  "version": "v3", "pipeline_id": "my-pipeline", "name": "x",
  "sources": [{"type": "kafka", "source_id": "a", ` + kafkaConn + `, "topic": "t1"}],
  "transforms": [
    {"type": "dedup", "source_id": "a", "config": {"key": "k", "time_window": "1h"}},
    {"type": "dedup", "source_id": "a", "config": {"key": "k", "time_window": "1h"}}
  ],
  ` + sinkJSON + `
}`,
	}

	for name, j := range cases {
		t.Run(name, func(t *testing.T) {
			cfg := mustParseJSON(t, j)
			if _, err := cfg.toModel(); err == nil {
				t.Fatal("toModel: expected error, got nil")
			}
		})
	}
}
