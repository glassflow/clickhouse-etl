package api

import (
	"testing"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// TestRoundTrip_JSONToModelToJSON parses a v3 JSON fixture, converts it to the
// model, converts back to v3, re-runs toModel on the round-tripped v3, and
// asserts the two model representations agree on the load-bearing fields.
//
// A strict deep-equal is not useful because toModel synthesizes IDs
// (join/stateless), fills defaults (consumer group offset, max delay), and
// the model's NewPipelineConfig stamps CreatedAt.
func TestRoundTrip_JSONToModelToJSON_Kafka(t *testing.T) {
	cfg := mustParseJSON(t, kafkaSingleDedupJSON)
	m1, err := cfg.toModel()
	if err != nil {
		t.Fatalf("first toModel: %v", err)
	}

	pipelineJs := toJSON(m1)
	if pipelineJs.Version != "v3" {
		t.Errorf("v3.Version = %q; want v3", pipelineJs.Version)
	}

	m2, err := pipelineJs.toModel()
	if err != nil {
		t.Fatalf("second toModel on round-tripped pipeline json: %v", err)
	}

	// Load-bearing invariants.
	if m1.ID != m2.ID || m1.Name != m2.Name || m1.SourceType != m2.SourceType {
		t.Errorf("top-level drift: (%s,%s,%s) vs (%s,%s,%s)",
			m1.ID, m1.Name, m1.SourceType, m2.ID, m2.Name, m2.SourceType)
	}
	if len(m1.Ingestor.KafkaTopics) != len(m2.Ingestor.KafkaTopics) {
		t.Fatalf("KafkaTopics len: %d vs %d", len(m1.Ingestor.KafkaTopics), len(m2.Ingestor.KafkaTopics))
	}
	for i := range m1.Ingestor.KafkaTopics {
		t1, t2 := m1.Ingestor.KafkaTopics[i], m2.Ingestor.KafkaTopics[i]
		if t1.Name != t2.Name {
			t.Errorf("topic[%d].Name: %q vs %q", i, t1.Name, t2.Name)
		}
		if t1.Deduplication != t2.Deduplication {
			t.Errorf("topic[%d].Deduplication: %+v vs %+v", i, t1.Deduplication, t2.Deduplication)
		}
	}
	if m1.Sink.SourceID != m2.Sink.SourceID {
		t.Errorf("Sink.SourceID: %q vs %q", m1.Sink.SourceID, m2.Sink.SourceID)
	}
	if m1.Sink.Batch.MaxBatchSize != m2.Sink.Batch.MaxBatchSize {
		t.Errorf("Sink.Batch.MaxBatchSize: %d vs %d", m1.Sink.Batch.MaxBatchSize, m2.Sink.Batch.MaxBatchSize)
	}
	if m1.Sink.Batch.MaxDelayTime.Duration() != m2.Sink.Batch.MaxDelayTime.Duration() {
		t.Errorf("Sink.Batch.MaxDelayTime: %s vs %s", m1.Sink.Batch.MaxDelayTime.Duration(), m2.Sink.Batch.MaxDelayTime.Duration())
	}
	if len(m1.SchemaVersions) != len(m2.SchemaVersions) {
		t.Errorf("SchemaVersions size: %d vs %d", len(m1.SchemaVersions), len(m2.SchemaVersions))
	}
}

func TestRoundTrip_JSONToModelToJSON_Join(t *testing.T) {
	cfg := mustParseJSON(t, kafkaJoinJSON)
	m1, err := cfg.toModel()
	if err != nil {
		t.Fatalf("first toModel: %v", err)
	}

	pipeline := toJSON(m1)
	if pipeline.Join == nil || !pipeline.Join.Enabled {
		t.Fatal("v3.Join should be enabled after round-trip")
	}
	if pipeline.Join.LeftSource.SourceID != "orders" || pipeline.Join.RightSource.SourceID != "users" {
		t.Errorf("join sides = (%s, %s); want (orders, users)",
			pipeline.Join.LeftSource.SourceID, pipeline.Join.RightSource.SourceID)
	}
	if len(pipeline.Join.OutputFields) != 2 {
		t.Errorf("join output_fields len = %d; want 2", len(pipeline.Join.OutputFields))
	}

	m2, err := pipeline.toModel()
	if err != nil {
		t.Fatalf("second toModel: %v", err)
	}
	if len(m1.Join.Sources) != len(m2.Join.Sources) {
		t.Errorf("Join.Sources len: %d vs %d", len(m1.Join.Sources), len(m2.Join.Sources))
	}
	if len(m1.Join.Config) != len(m2.Join.Config) {
		t.Errorf("Join.Config len: %d vs %d", len(m1.Join.Config), len(m2.Join.Config))
	}
}

func TestRoundTrip_JSONToModelToJSON_OTLP(t *testing.T) {
	cfg := mustParseJSON(t, otlpJSON)
	m1, err := cfg.toModel()
	if err != nil {
		t.Fatalf("first toModel: %v", err)
	}
	pipeline := toJSON(m1)
	if len(pipeline.Sources) != 1 || pipeline.Sources[0].Type != "otlp.traces" {
		t.Fatalf("sources = %+v; want one otlp.traces", pipeline.Sources)
	}
	if len(pipeline.Transforms) != 1 || pipeline.Transforms[0].Type != transformTypeDedup {
		t.Fatalf("transforms = %+v; want one dedup", pipeline.Transforms)
	}
	dedup := pipeline.Transforms[0].Config
	if dedup.Key != "trace_id" || dedup.TimeWindow.Duration() != time.Hour {
		t.Errorf("dedup = %+v; want trace_id/1h", dedup)
	}

	m2, err := pipeline.toModel()
	if err != nil {
		t.Fatalf("second toModel: %v", err)
	}
	if !m2.OTLPSource.Deduplication.Enabled || m2.OTLPSource.Deduplication.ID != "trace_id" {
		t.Errorf("OTLP dedup lost: %+v", m2.OTLPSource.Deduplication)
	}
	if !m1.SourceType.IsOTLP() || !m2.SourceType.IsOTLP() {
		t.Errorf("SourceType drift: %s vs %s", m1.SourceType, m2.SourceType)
	}
}

func TestToJSON_EmptyJoin(t *testing.T) {
	// A model without a join should emit cfg.Join == nil, which
	// omits the field from the JSON output.
	p := models.PipelineConfig{
		ID:         "id-x",
		Name:       "n",
		SourceType: "kafka",
	}
	pipeline := toJSON(p)
	if pipeline.Join != nil {
		t.Errorf("Join should be nil when not enabled; got %+v", pipeline.Join)
	}
}
