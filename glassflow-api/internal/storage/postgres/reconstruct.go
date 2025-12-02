package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// reconstructPipelineConfig reconstructs a PipelineConfig from pipelineData
func (s *PostgresStorage) reconstructPipelineConfig(ctx context.Context, data *pipelineData) (*models.PipelineConfig, error) {
	metadata, err := unmarshalMetadata(data.metadataJSON)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to unmarshal metadata",
			slog.String("pipeline_id", data.pipelineID),
			slog.String("error", err.Error()))
		return nil, err
	}

	ingestorConfig, err := reconstructKafkaConfig(data.kafkaConn)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct kafka config",
			slog.String("pipeline_id", data.pipelineID),
			slog.String("error", err.Error()))
		return nil, err
	}

	mapperConfig, err := reconstructMapperConfig(data.source, data.sink)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct mapper config",
			slog.String("pipeline_id", data.pipelineID),
			slog.String("error", err.Error()))
		return nil, err
	}

	sinkComponentConfig, err := reconstructSinkConfig(data.chConn)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct sink config",
			slog.String("pipeline_id", data.pipelineID),
			slog.String("error", err.Error()))
		return nil, err
	}

	joinConfig := reconstructJoinConfig(data.transformations)
	filterConfig := reconstructFilterConfig(data.transformations)

	id := data.pipelineID
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
func reconstructKafkaConfig(kafkaConnJSON json.RawMessage) (models.IngestorComponentConfig, error) {
	var cfg models.IngestorComponentConfig
	if err := json.Unmarshal(kafkaConnJSON, &cfg); err != nil {
		return models.IngestorComponentConfig{}, fmt.Errorf("unmarshal kafka connection config: %w", err)
	}
	return cfg, nil
}

// reconstructMapperConfig reconstructs MapperConfig from source and sink configs
func reconstructMapperConfig(sourceConfigJSON, sinkConfigJSON json.RawMessage) (models.MapperConfig, error) {
	var sourceWrapper struct {
		Streams map[string]models.StreamSchemaConfig `json:"streams"`
	}
	if err := json.Unmarshal(sourceConfigJSON, &sourceWrapper); err != nil {
		return models.MapperConfig{}, fmt.Errorf("unmarshal source config: %w", err)
	}

	var sinkWrapper struct {
		SinkMapping []models.SinkMappingConfig `json:"sink_mapping"`
	}
	if err := json.Unmarshal(sinkConfigJSON, &sinkWrapper); err != nil {
		return models.MapperConfig{}, fmt.Errorf("unmarshal sink config: %w", err)
	}

	return models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     sourceWrapper.Streams,
		SinkMapping: sinkWrapper.SinkMapping,
	}, nil
}

// reconstructSinkConfig reconstructs SinkComponentConfig from ClickHouse connection config
func reconstructSinkConfig(chConnJSON json.RawMessage) (models.SinkComponentConfig, error) {
	var cfg models.SinkComponentConfig
	if err := json.Unmarshal(chConnJSON, &cfg); err != nil {
		return models.SinkComponentConfig{}, fmt.Errorf("unmarshal clickhouse connection config: %w", err)
	}
	return cfg, nil
}

// reconstructJoinConfig reconstructs JoinComponentConfig from transformations
func reconstructJoinConfig(transformations map[string]Transformation) models.JoinComponentConfig {
	joinConfig := models.JoinComponentConfig{Enabled: false}
	if joinTrans, ok := transformations["join"]; ok {
		_ = json.Unmarshal(joinTrans.Config, &joinConfig)
	}
	return joinConfig
}

// reconstructFilterConfig reconstructs FilterComponentConfig from transformations
func reconstructFilterConfig(transformations map[string]Transformation) models.FilterComponentConfig {
	filterConfig := models.FilterComponentConfig{Enabled: false}
	if filterTrans, ok := transformations["filter"]; ok {
		_ = json.Unmarshal(filterTrans.Config, &filterConfig)
	}
	return filterConfig
}
