package datamigrations

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// v2 DB shapes — these mirror what is stored in sources.config and sinks.config
// JSONB columns for pre-v3 pipelines.

type v2StreamDataField struct {
	FieldName string `json:"field_name"`
	FieldType string `json:"field_type"`
}

type v2StreamSchemaConfig struct {
	Fields []v2StreamDataField `json:"fields"`
}

type v2SourceConfig struct {
	Streams map[string]v2StreamSchemaConfig `json:"streams"`
}

type v2SinkMappingEntry struct {
	ColumnName string `json:"column_name"`
	StreamName string `json:"stream_name"`
	FieldName  string `json:"field_name"`
	ColumnType string `json:"column_type"`
}

type v2SinkConfig struct {
	SinkMapping []v2SinkMappingEntry `json:"sink_mapping"`
}

type v2StatelessTransformation struct {
	ID       string `json:"id"`
	Enabled  bool   `json:"enabled"`
	SourceID string `json:"source_id"`
	Config   struct {
		Transform []models.Transform `json:"transform"`
	} `json:"config"`
}

type v2JoinSource struct {
	SourceID string `json:"source_id"`
}

type v2JoinConfig struct {
	ID      string            `json:"id"`
	Enabled bool              `json:"enabled"`
	Sources []v2JoinSource    `json:"sources"`
	Config  []models.JoinRule `json:"config"`
}

type v2Pipeline struct {
	id         string
	sourceID   string // sources table UUID
	sinkID     string // sinks table UUID
	sourceType string
}

func migrateV2ToV3(ctx context.Context, tx pgx.Tx) error {
	pipelines, err := loadV2Pipelines(ctx, tx)
	if err != nil {
		return err
	}

	for _, p := range pipelines {
		if err := migratePipeline(ctx, tx, p); err != nil {
			return fmt.Errorf("pipeline %s: %w", p.id, err)
		}
	}

	return nil
}

func loadV2Pipelines(ctx context.Context, tx pgx.Tx) ([]v2Pipeline, error) {
	rows, err := tx.Query(ctx, `
		SELECT p.id, p.source_id, p.sink_id, s.type
		FROM pipelines p
		JOIN sources s ON s.id = p.source_id::uuid
		WHERE p.version != 'v3' OR p.version IS NULL
	`)
	if err != nil {
		return nil, fmt.Errorf("query unmigrated pipelines: %w", err)
	}
	defer rows.Close()

	var pipelines []v2Pipeline
	for rows.Next() {
		var p v2Pipeline
		if err := rows.Scan(&p.id, &p.sourceID, &p.sinkID, &p.sourceType); err != nil {
			return nil, fmt.Errorf("scan pipeline row: %w", err)
		}
		pipelines = append(pipelines, p)
	}

	return pipelines, rows.Err()
}

func migratePipeline(ctx context.Context, tx pgx.Tx, p v2Pipeline) error {
	// Backfill kafka_topics[].id in the connection config for topics where id=""
	// (pipelines created before topic IDs were introduced used topic name as streams key).
	// Must run before upsertSourceSchemaVersions so source_id values align with topic.ID.
	if err := backfillTopicIDs(ctx, tx, p.sourceID); err != nil {
		return err
	}

	srcCfg, err := loadSourceConfig(ctx, tx, p.sourceID)
	if err != nil {
		return err
	}

	sinkCfg, err := loadSinkConfig(ctx, tx, p.sinkID)
	if err != nil {
		return err
	}

	stateless, err := loadStatelessTransformation(ctx, tx, p.id)
	if err != nil {
		return err
	}

	join, err := loadJoinConfig(ctx, tx, p.id)
	if err != nil {
		return err
	}

	if err := upsertSourceSchemaVersions(ctx, tx, p.id, srcCfg); err != nil {
		return err
	}

	if stateless != nil {
		if err := upsertStatelessTransformConfig(ctx, tx, p.id, stateless); err != nil {
			return err
		}
	}

	if join != nil {
		if err := upsertJoinConfigs(ctx, tx, p.id, join, srcCfg); err != nil {
			return err
		}
	}

	sinkSourceID := deriveSinkSourceID(srcCfg, stateless, join)
	if err := upsertSinkConfig(ctx, tx, p.id, sinkSourceID, sinkCfg, srcCfg, stateless, join); err != nil {
		return err
	}

	if err := markPipelineV3(ctx, tx, p.id); err != nil {
		return err
	}

	return clearSourceStreams(ctx, tx, p.sourceID)
}

// upsertSourceSchemaVersions populates schema_versions for each Kafka topic.
func upsertSourceSchemaVersions(ctx context.Context, tx pgx.Tx, pipelineID string, src v2SourceConfig) error {
	for sourceID, stream := range src.Streams {
		fields := toSchemaFields(stream.Fields)
		fieldsJSON, err := json.Marshal(fields)
		if err != nil {
			return fmt.Errorf("marshal schema fields for source %s: %w", sourceID, err)
		}

		_, err = tx.Exec(ctx, `
			INSERT INTO schema_versions (pipeline_id, source_id, version_id, data_format, fields)
			VALUES ($1, $2, '1', 'json', $3)
			ON CONFLICT (pipeline_id, source_id, version_id)
			DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()
		`, pipelineID, sourceID, string(fieldsJSON))
		if err != nil {
			return fmt.Errorf("upsert schema_versions for source %s: %w", sourceID, err)
		}
	}

	return nil
}

// upsertStatelessTransformConfig populates schema_versions for the transform output
// and inserts the transformation_configs row.
func upsertStatelessTransformConfig(ctx context.Context, tx pgx.Tx, pipelineID string, t *v2StatelessTransformation) error {
	outputFields := make([]models.Field, 0, len(t.Config.Transform))
	for _, tr := range t.Config.Transform {
		outputFields = append(outputFields, models.Field{Name: tr.OutputName, Type: tr.OutputType})
	}

	outputFieldsJSON, err := json.Marshal(outputFields)
	if err != nil {
		return fmt.Errorf("marshal transform output fields: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO schema_versions (pipeline_id, source_id, version_id, data_format, fields)
		VALUES ($1, $2, '1', 'json', $3)
		ON CONFLICT (pipeline_id, source_id, version_id)
		DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()
	`, pipelineID, t.ID, string(outputFieldsJSON))
	if err != nil {
		return fmt.Errorf("upsert schema_versions for transform output %s: %w", t.ID, err)
	}

	configJSON, err := json.Marshal(t.Config.Transform)
	if err != nil {
		return fmt.Errorf("marshal transform config: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO transformation_configs
			(pipeline_id, source_id, schema_version_id, transformation_id, output_schema_version_id, config)
		VALUES ($1, $2, '1', $3, '1', $4)
		ON CONFLICT (pipeline_id, source_id, schema_version_id)
		DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
	`, pipelineID, t.SourceID, t.ID, string(configJSON))
	if err != nil {
		return fmt.Errorf("upsert transformation_configs for transform %s: %w", t.ID, err)
	}

	return nil
}

// upsertJoinConfigs populates schema_versions for the join output and inserts
// join_configs rows for each join source.
func upsertJoinConfigs(ctx context.Context, tx pgx.Tx, pipelineID string, j *v2JoinConfig, src v2SourceConfig) error {
	outputFields := buildJoinOutputFields(j.Config, src.Streams)
	outputFieldsJSON, err := json.Marshal(outputFields)
	if err != nil {
		return fmt.Errorf("marshal join output fields: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO schema_versions (pipeline_id, source_id, version_id, data_format, fields)
		VALUES ($1, $2, '1', 'json', $3)
		ON CONFLICT (pipeline_id, source_id, version_id)
		DO UPDATE SET fields = EXCLUDED.fields, updated_at = NOW()
	`, pipelineID, j.ID, string(outputFieldsJSON))
	if err != nil {
		return fmt.Errorf("upsert schema_versions for join output %s: %w", j.ID, err)
	}

	configJSON, err := json.Marshal(j.Config)
	if err != nil {
		return fmt.Errorf("marshal join config: %w", err)
	}

	for _, s := range j.Sources {
		_, err = tx.Exec(ctx, `
			INSERT INTO join_configs
				(pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id, config)
			VALUES ($1, $2, '1', $3, '1', $4)
			ON CONFLICT (pipeline_id, source_id, schema_version_id, join_id, output_schema_version_id)
			DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
		`, pipelineID, s.SourceID, j.ID, string(configJSON))
		if err != nil {
			return fmt.Errorf("upsert join_configs for source %s: %w", s.SourceID, err)
		}
	}

	return nil
}

// upsertSinkConfig builds and inserts the sink_configs row.
func upsertSinkConfig(
	ctx context.Context,
	tx pgx.Tx,
	pipelineID, sinkSourceID string,
	sink v2SinkConfig,
	src v2SourceConfig,
	stateless *v2StatelessTransformation,
	join *v2JoinConfig,
) error {
	mappings := buildSinkMappings(sink.SinkMapping, src.Streams, stateless, join)

	configJSON, err := json.Marshal(mappings)
	if err != nil {
		return fmt.Errorf("marshal sink mappings: %w", err)
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO sink_configs (pipeline_id, source_id, schema_version_id, config)
		VALUES ($1, $2, '1', $3)
		ON CONFLICT (pipeline_id, source_id, schema_version_id)
		DO UPDATE SET config = EXCLUDED.config, updated_at = NOW()
	`, pipelineID, sinkSourceID, string(configJSON))
	if err != nil {
		return fmt.Errorf("upsert sink_configs: %w", err)
	}

	return nil
}

func markPipelineV3(ctx context.Context, tx pgx.Tx, pipelineID string) error {
	_, err := tx.Exec(ctx, `UPDATE pipelines SET version = 'v3' WHERE id = $1`, pipelineID)
	return err
}

// clearSourceStreams empties streams from sources.config so the backward-compat
// gate in loadConfigsAndSchemaVersions does not fire and the new schema_versions
// path is used instead.
func clearSourceStreams(ctx context.Context, tx pgx.Tx, sourceID string) error {
	_, err := tx.Exec(ctx,
		`UPDATE sources SET config = '{"streams":{}}' WHERE id = $1::uuid`,
		sourceID,
	)
	return err
}

// backfillTopicIDs sets kafka_topics[].id = name for any topic whose id is empty.
// Pipelines created before topic IDs were introduced stored the topic name as both
// the streams map key and the topic identifier. The v3 load path looks up
// schema_versions by topic.ID, so we must ensure IDs are populated.
func backfillTopicIDs(ctx context.Context, tx pgx.Tx, sourceID string) error {
	var raw []byte
	err := tx.QueryRow(ctx, `
		SELECT c.config
		FROM connections c
		JOIN sources s ON s.connection_id = c.id
		WHERE s.id = $1::uuid
	`, sourceID).Scan(&raw)
	if err == pgx.ErrNoRows {
		return nil // OTLP source or no connection — nothing to do
	}
	if err != nil {
		return fmt.Errorf("load connection config for source %s: %w", sourceID, err)
	}

	var cfg struct {
		KafkaTopics []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"kafka_topics"`
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return fmt.Errorf("unmarshal connection config for source %s: %w", sourceID, err)
	}

	needsUpdate := false
	for i, t := range cfg.KafkaTopics {
		if t.ID == "" {
			cfg.KafkaTopics[i].ID = t.Name
			needsUpdate = true
		}
	}
	if !needsUpdate {
		return nil
	}

	// Merge updated kafka_topics back into the full config JSONB.
	topicsJSON, err := json.Marshal(cfg.KafkaTopics)
	if err != nil {
		return fmt.Errorf("marshal kafka_topics for source %s: %w", sourceID, err)
	}

	_, err = tx.Exec(ctx, `
		UPDATE connections SET config = jsonb_set(config, '{kafka_topics}', $1::jsonb)
		WHERE id = (SELECT connection_id FROM sources WHERE id = $2::uuid)
	`, string(topicsJSON), sourceID)
	if err != nil {
		return fmt.Errorf("update connection topic IDs for source %s: %w", sourceID, err)
	}

	return nil
}

// --- data loaders ---

func loadSourceConfig(ctx context.Context, tx pgx.Tx, sourceID string) (v2SourceConfig, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT config FROM sources WHERE id = $1::uuid`, sourceID).Scan(&raw)
	if err != nil {
		return v2SourceConfig{}, fmt.Errorf("load source config: %w", err)
	}

	var cfg v2SourceConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return v2SourceConfig{}, fmt.Errorf("unmarshal source config: %w", err)
	}

	return cfg, nil
}

func loadSinkConfig(ctx context.Context, tx pgx.Tx, sinkID string) (v2SinkConfig, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `SELECT config FROM sinks WHERE id = $1::uuid`, sinkID).Scan(&raw)
	if err != nil {
		return v2SinkConfig{}, fmt.Errorf("load sink config: %w", err)
	}

	var cfg v2SinkConfig
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return v2SinkConfig{}, fmt.Errorf("unmarshal sink config: %w", err)
	}

	return cfg, nil
}

func loadStatelessTransformation(ctx context.Context, tx pgx.Tx, pipelineID string) (*v2StatelessTransformation, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `
		SELECT config FROM transformations
		WHERE pipeline_id = $1 AND type = 'stateless_transformation'
	`, pipelineID).Scan(&raw)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load stateless transformation: %w", err)
	}

	var t v2StatelessTransformation
	if err := json.Unmarshal(raw, &t); err != nil {
		return nil, fmt.Errorf("unmarshal stateless transformation: %w", err)
	}

	return &t, nil
}

func loadJoinConfig(ctx context.Context, tx pgx.Tx, pipelineID string) (*v2JoinConfig, error) {
	var raw []byte
	err := tx.QueryRow(ctx, `
		SELECT config FROM transformations
		WHERE pipeline_id = $1 AND type = 'join'
	`, pipelineID).Scan(&raw)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("load join config: %w", err)
	}

	var j v2JoinConfig
	if err := json.Unmarshal(raw, &j); err != nil {
		return nil, fmt.Errorf("unmarshal join config: %w", err)
	}

	return &j, nil
}

// --- pure transformation helpers (unit-testable) ---

func toSchemaFields(fields []v2StreamDataField) []models.Field {
	out := make([]models.Field, len(fields))
	for i, f := range fields {
		out[i] = models.Field{
			Name: f.FieldName,
			Type: internal.NormalizeToBasicKafkaType(f.FieldType),
		}
	}
	return out
}

func buildJoinOutputFields(rules []models.JoinRule, streams map[string]v2StreamSchemaConfig) []models.Field {
	out := make([]models.Field, 0, len(rules))
	for _, rule := range rules {
		fieldType := lookupFieldType(rule.SourceName, rule.SourceID, streams)
		out = append(out, models.Field{Name: rule.OutputName, Type: fieldType})
	}
	return out
}

// buildSinkMappings converts v2 sink_mapping entries to v3 Mapping structs.
// SourceType is resolved from the schema for the field's origin.
func buildSinkMappings(
	entries []v2SinkMappingEntry,
	streams map[string]v2StreamSchemaConfig,
	stateless *v2StatelessTransformation,
	join *v2JoinConfig,
) []models.Mapping {
	out := make([]models.Mapping, 0, len(entries))
	for _, e := range entries {
		sourceType := resolveSourceType(e.FieldName, e.StreamName, streams, stateless, join)
		out = append(out, models.Mapping{
			SourceField:      e.FieldName,
			SourceType:       sourceType,
			DestinationField: e.ColumnName,
			DestinationType:  e.ColumnType,
		})
	}
	return out
}

// deriveSinkSourceID returns the source_id to use as the sink_configs key,
// following the same priority as the v3 API: join > stateless transform > topic.
func deriveSinkSourceID(src v2SourceConfig, stateless *v2StatelessTransformation, join *v2JoinConfig) string {
	if join != nil && join.Enabled {
		return join.ID
	}
	if stateless != nil && stateless.Enabled {
		return stateless.ID
	}
	for k := range src.Streams {
		return k
	}
	return ""
}

func lookupFieldType(fieldName, sourceID string, streams map[string]v2StreamSchemaConfig) string {
	stream, ok := streams[sourceID]
	if !ok {
		return ""
	}
	for _, f := range stream.Fields {
		if f.FieldName == fieldName {
			return internal.NormalizeToBasicKafkaType(f.FieldType)
		}
	}
	return ""
}

// resolveSourceType returns the field type for a sink mapping entry.
// For transform/join pipelines the type comes from the component output schema.
func resolveSourceType(
	fieldName, streamName string,
	streams map[string]v2StreamSchemaConfig,
	stateless *v2StatelessTransformation,
	join *v2JoinConfig,
) string {
	if stateless != nil && stateless.Enabled {
		for _, tr := range stateless.Config.Transform {
			if tr.OutputName == fieldName {
				return tr.OutputType
			}
		}
	}

	if join != nil && join.Enabled {
		for _, rule := range join.Config {
			if rule.OutputName == fieldName {
				return lookupFieldType(rule.SourceName, rule.SourceID, streams)
			}
		}
	}

	return lookupFieldType(fieldName, streamName, streams)
}
