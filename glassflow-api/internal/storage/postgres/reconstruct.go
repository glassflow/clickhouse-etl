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
			slog.String("pipeline_id", data.pipelineID.String()),
			slog.String("error", err.Error()))
		return nil, err
	}

	kafkaConnParams, provider, err := reconstructKafkaConfig(data.kafkaConn)
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

	kafkaTopics := reconstructKafkaTopics(data.kafkaConn)

	ingestorConfig := models.IngestorComponentConfig{
		Type:                  "kafka",
		Provider:              provider,
		KafkaConnectionParams: kafkaConnParams,
		KafkaTopics:           kafkaTopics,
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

// reconstructKafkaConfig reconstructs Kafka connection params and provider
func reconstructKafkaConfig(kafkaConn map[string]any) (models.KafkaConnectionParamsConfig, string, error) {
	kafkaConnParamsRaw, ok := kafkaConn["kafka_connection_params"].(map[string]any)
	if !ok {
		return models.KafkaConnectionParamsConfig{}, "", fmt.Errorf("invalid kafka_connection_params in connection config")
	}

	kafkaConnParamsJSON, err := json.Marshal(kafkaConnParamsRaw)
	if err != nil {
		return models.KafkaConnectionParamsConfig{}, "", fmt.Errorf("marshal kafka connection params: %w", err)
	}

	var kafkaConnParams models.KafkaConnectionParamsConfig
	if err := json.Unmarshal(kafkaConnParamsJSON, &kafkaConnParams); err != nil {
		return models.KafkaConnectionParamsConfig{}, "", fmt.Errorf("unmarshal kafka connection params: %w", err)
	}

	provider := ""
	if providerRaw, ok := kafkaConn["provider"].(string); ok {
		provider = providerRaw
	}

	return kafkaConnParams, provider, nil
}

// reconstructMapperConfig reconstructs MapperConfig from source and sink configs
func reconstructMapperConfig(sourceConfig, sinkConfig map[string]any) (models.MapperConfig, error) {
	streamsRaw, ok := sourceConfig["streams"].(map[string]any)
	if !ok {
		return models.MapperConfig{}, fmt.Errorf("invalid streams in source config")
	}

	streams := make(map[string]models.StreamSchemaConfig)
	for streamName, streamRaw := range streamsRaw {
		streamJSON, err := json.Marshal(streamRaw)
		if err != nil {
			return models.MapperConfig{}, fmt.Errorf("marshal stream %s: %w", streamName, err)
		}
		var streamCfg models.StreamSchemaConfig
		if err := json.Unmarshal(streamJSON, &streamCfg); err != nil {
			return models.MapperConfig{}, fmt.Errorf("unmarshal stream %s: %w", streamName, err)
		}
		streams[streamName] = streamCfg
	}

	sinkMappingRaw, ok := sinkConfig["sink_mapping"].([]any)
	if !ok {
		return models.MapperConfig{}, fmt.Errorf("invalid sink_mapping in sink config")
	}

	sinkMappingJSON, err := json.Marshal(sinkMappingRaw)
	if err != nil {
		return models.MapperConfig{}, fmt.Errorf("marshal sink mapping: %w", err)
	}

	var sinkMapping []models.SinkMappingConfig
	if err := json.Unmarshal(sinkMappingJSON, &sinkMapping); err != nil {
		return models.MapperConfig{}, fmt.Errorf("unmarshal sink mapping: %w", err)
	}

	return models.MapperConfig{
		Type:        internal.SchemaMapperJSONToCHType,
		Streams:     streams,
		SinkMapping: sinkMapping,
	}, nil
}

// reconstructKafkaTopics reconstructs Kafka topics from connection config
func reconstructKafkaTopics(kafkaConn map[string]any) []models.KafkaTopicsConfig {
	var kafkaTopics []models.KafkaTopicsConfig
	if topicsRaw, ok := kafkaConn["kafka_topics"].([]any); ok {
		topicsJSON, err := json.Marshal(topicsRaw)
		if err != nil {
			return kafkaTopics
		}
		_ = json.Unmarshal(topicsJSON, &kafkaTopics)
	}
	return kafkaTopics
}

// reconstructSinkConfig reconstructs SinkComponentConfig from ClickHouse connection config
func reconstructSinkConfig(chConn map[string]any) (models.SinkComponentConfig, error) {
	chConnParamsRaw, ok := chConn["clickhouse_connection_params"].(map[string]any)
	if !ok {
		return models.SinkComponentConfig{}, fmt.Errorf("invalid clickhouse_connection_params in connection config")
	}

	chConnParamsJSON, err := json.Marshal(chConnParamsRaw)
	if err != nil {
		return models.SinkComponentConfig{}, fmt.Errorf("marshal clickhouse connection params: %w", err)
	}

	var chConnParams models.ClickHouseConnectionParamsConfig
	if err := json.Unmarshal(chConnParamsJSON, &chConnParams); err != nil {
		return models.SinkComponentConfig{}, fmt.Errorf("unmarshal clickhouse connection params: %w", err)
	}

	var batchConfig models.BatchConfig
	if batchRaw, ok := chConn["batch"].(map[string]any); ok {
		batchJSON, err := json.Marshal(batchRaw)
		if err != nil {
			return models.SinkComponentConfig{}, fmt.Errorf("marshal batch config: %w", err)
		}
		if err := json.Unmarshal(batchJSON, &batchConfig); err != nil {
			return models.SinkComponentConfig{}, fmt.Errorf("unmarshal batch config: %w", err)
		}
	}

	streamID := ""
	if streamIDRaw, ok := chConn["stream_id"].(string); ok {
		streamID = streamIDRaw
	}

	return models.SinkComponentConfig{
		Type:                       "clickhouse",
		StreamID:                   streamID,
		Batch:                      batchConfig,
		ClickHouseConnectionParams: chConnParams,
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
