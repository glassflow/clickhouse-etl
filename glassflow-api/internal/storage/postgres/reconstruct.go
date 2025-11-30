package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type kafkaConnectionConfig struct {
	KafkaConnectionParams models.KafkaConnectionParamsConfig `json:"kafka_connection_params"`
	KafkaTopics           []models.KafkaTopicsConfig         `json:"kafka_topics"`
	Provider              string                             `json:"provider"`
}

type sourceConfig struct {
	Streams map[string]models.StreamSchemaConfig `json:"streams"`
}

type sinkConfig struct {
	SinkMapping []models.SinkMappingConfig `json:"sink_mapping"`
}

type clickHouseConnectionConfig struct {
	ClickHouseConnectionParams models.ClickHouseConnectionParamsConfig `json:"clickhouse_connection_params"`
	Batch                      models.BatchConfig                      `json:"batch"`
	StreamID                   string                                  `json:"stream_id"`
}

// reconstructPipelineConfig reconstructs a PipelineConfig from pipelineData
func (s *PostgresStorage) reconstructPipelineConfig(ctx context.Context, data *pipelineData) (*models.PipelineConfig, error) {
	metadata, err := unmarshalMetadata(data.metadataJSON)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to unmarshal metadata",
			slog.String("pipeline_id", data.pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, err
	}

	kafkaConnCfg, err := reconstructKafkaConfig(data.kafkaConn)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct kafka config",
			slog.String("pipeline_id", data.pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, err
	}

	mapperConfig, err := reconstructMapperConfig(data.source, data.sink)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct mapper config",
			slog.String("pipeline_id", data.pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, err
	}

	ingestorConfig := models.IngestorComponentConfig{
		Type:                  "kafka",
		Provider:              kafkaConnCfg.Provider,
		KafkaConnectionParams: kafkaConnCfg.KafkaConnectionParams,
		KafkaTopics:           kafkaConnCfg.KafkaTopics,
	}

	sinkComponentConfig, err := reconstructSinkConfig(data.chConn)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct sink config",
			slog.String("pipeline_id", data.pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, err
	}

	joinConfig := reconstructJoinConfig(data.transformations)
	filterConfig := reconstructFilterConfig(data.transformations)

	id := data.pipelineID.String()
	cfg := &models.PipelineConfig{
		ID:        id,
		Name:      data.name,
		Mapper:    mapperConfig,
		Ingestor:  ingestorConfig,
		Join:      joinConfig,
		Sink:      sinkComponentConfig,
		Filter:    filterConfig,
		CreatedAt: data.createdAt,
		Metadata:  metadata,
		Status: models.PipelineHealth{
			PipelineID:    id,
			PipelineName:  data.name,
			OverallStatus: models.PipelineStatus(data.status),
			UpdatedAt:     data.updatedAt,
		},
	}

	return cfg, nil
}

// reconstructKafkaConfig reconstructs Kafka connection config from JSONB
func reconstructKafkaConfig(kafkaConnJSON json.RawMessage) (kafkaConnectionConfig, error) {
	var cfg kafkaConnectionConfig
	if err := json.Unmarshal(kafkaConnJSON, &cfg); err != nil {
		return kafkaConnectionConfig{}, fmt.Errorf("unmarshal kafka connection config: %w", err)
	}
	return cfg, nil
}

// reconstructMapperConfig reconstructs MapperConfig from source and sink configs
func reconstructMapperConfig(sourceConfigJSON, sinkConfigJSON json.RawMessage) (models.MapperConfig, error) {
	var sourceCfg sourceConfig
	if err := json.Unmarshal(sourceConfigJSON, &sourceCfg); err != nil {
		return models.MapperConfig{}, fmt.Errorf("unmarshal source config: %w", err)
	}

	var sinkCfg sinkConfig
	if err := json.Unmarshal(sinkConfigJSON, &sinkCfg); err != nil {
		return models.MapperConfig{}, fmt.Errorf("unmarshal sink config: %w", err)
	}

	return models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     sourceCfg.Streams,
		SinkMapping: sinkCfg.SinkMapping,
	}, nil
}

// reconstructSinkConfig reconstructs SinkComponentConfig from ClickHouse connection config
func reconstructSinkConfig(chConnJSON json.RawMessage) (models.SinkComponentConfig, error) {
	var chConnCfg clickHouseConnectionConfig
	if err := json.Unmarshal(chConnJSON, &chConnCfg); err != nil {
		return models.SinkComponentConfig{}, fmt.Errorf("unmarshal clickhouse connection config: %w", err)
	}

	return models.SinkComponentConfig{
		Type:                       "clickhouse",
		StreamID:                   chConnCfg.StreamID,
		Batch:                      chConnCfg.Batch,
		ClickHouseConnectionParams: chConnCfg.ClickHouseConnectionParams,
	}, nil
}

// reconstructJoinConfig reconstructs JoinComponentConfig from transformations
func reconstructJoinConfig(transformations map[string]any) models.JoinComponentConfig {
	joinConfig := models.JoinComponentConfig{Enabled: false}
	if joinRaw, ok := transformations["join"].(map[string]any); ok {
		joinJSON, err := json.Marshal(joinRaw)
		if err != nil {
			return joinConfig
		}
		_ = json.Unmarshal(joinJSON, &joinConfig)
	}
	return joinConfig
}

// reconstructFilterConfig reconstructs FilterComponentConfig from transformations
func reconstructFilterConfig(transformations map[string]any) models.FilterComponentConfig {
	filterConfig := models.FilterComponentConfig{Enabled: false}
	if filterRaw, ok := transformations["filter"].(map[string]any); ok {
		filterJSON, err := json.Marshal(filterRaw)
		if err != nil {
			return filterConfig
		}
		_ = json.Unmarshal(filterJSON, &filterConfig)
	}
	return filterConfig
}
