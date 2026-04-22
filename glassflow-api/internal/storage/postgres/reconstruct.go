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

	ingestorConfig, err := reconstructKafkaConfig(data)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct kafka config",
			slog.String("pipeline_id", data.pipelineID),
			slog.String("error", err.Error()))
		return nil, err
	}

	otlpSourceConfig, err := reconstructOTLPSourceConfig(data)
	if err != nil {
		s.logger.ErrorContext(ctx, "failed to reconstruct otlp source config",
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

	joinConfig, err := reconstructJoinConfig(data.transformations)
	if err != nil {
		return nil, fmt.Errorf("reconstruct join config: %w", err)
	}
	filterConfig, err := reconstructFilterConfig(data.transformations)
	if err != nil {
		return nil, fmt.Errorf("reconstruct filter config: %w", err)
	}
	statelessTransformationConfig, err := reconstructStatelessTransformationConfig(data.transformations)
	if err != nil {
		return nil, fmt.Errorf("reconstruct stateless transformation config: %w", err)
	}

	id := data.pipelineID
	cfg := &models.PipelineConfig{
		ID:                      id,
		Name:                    data.name,
		SourceType:              models.SourceType(data.sourceType),
		OTLPSource:              otlpSourceConfig,
		Mapper:                  mapperConfig,
		Ingestor:                ingestorConfig,
		Join:                    joinConfig,
		Sink:                    sinkComponentConfig,
		Filter:                  filterConfig,
		StatelessTransformation: statelessTransformationConfig,
		CreatedAt:               data.createdAt,
		Metadata:                metadata,
		Status: models.PipelineHealth{
			PipelineID:    id,
			PipelineName:  data.name,
			OverallStatus: models.PipelineStatus(data.status),
			CreatedAt:     data.createdAt,
			UpdatedAt:     data.updatedAt,
		},
	}

	return cfg, nil
}

// reconstructOTLPSourceConfig reconstructs OTLPSourceConfig from JSONB
func reconstructOTLPSourceConfig(data *pipelineData) (zero models.OTLPSourceConfig, _ error) {
	if !models.SourceType(data.sourceType).IsOTLP() {
		return zero, nil
	}

	if len(data.source) == 0 {
		return zero, fmt.Errorf("otlp source config is empty")
	}

	var cfg models.OTLPSourceConfig
	if err := json.Unmarshal(data.source, &cfg); err != nil {
		return zero, fmt.Errorf("unmarshal otlp source config: %w", err)
	}
	return cfg, nil
}

// reconstructKafkaConfig reconstructs Kafka connection config from JSONB
func reconstructKafkaConfig(data *pipelineData) (zero models.IngestorComponentConfig, _ error) {
	if data.sourceType != internal.KafkaIngestorType {
		return zero, nil
	}

	if len(data.kafkaConn) == 0 {
		return zero, fmt.Errorf("kafka source config is empty")
	}

	var cfg models.IngestorComponentConfig
	if err := json.Unmarshal(data.kafkaConn, &cfg); err != nil {
		return zero, fmt.Errorf("unmarshal kafka connection config: %w", err)
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

	// Normalize field types to basic types (e.g. int32 -> int) for existing configs
	for _, streamCfg := range sourceWrapper.Streams {
		for i := range streamCfg.Fields {
			streamCfg.Fields[i].FieldType = internal.NormalizeToBasicKafkaType(streamCfg.Fields[i].FieldType)
		}
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
func reconstructJoinConfig(transformations map[string]Transformation) (models.JoinComponentConfig, error) {
	joinConfig := models.JoinComponentConfig{Enabled: false}
	if joinTrans, ok := transformations["join"]; ok {
		if err := json.Unmarshal(joinTrans.Config, &joinConfig); err != nil {
			return joinConfig, fmt.Errorf("unmarshal join config: %w", err)
		}
		// The v2 config blob may not contain the ID — always use the DB row ID as source of truth.
		joinConfig.ID = joinTrans.ID
	}
	return joinConfig, nil
}

// reconstructFilterConfig reconstructs FilterComponentConfig from transformations
func reconstructFilterConfig(transformations map[string]Transformation) (models.FilterComponentConfig, error) {
	filterConfig := models.FilterComponentConfig{Enabled: false}
	if filterTrans, ok := transformations["filter"]; ok {
		if err := json.Unmarshal(filterTrans.Config, &filterConfig); err != nil {
			return filterConfig, fmt.Errorf("unmarshal filter config: %w", err)
		}
	}
	return filterConfig, nil
}

// reconstructStatelessTransformationConfig reconstructs StatelessTransformation from transformations
func reconstructStatelessTransformationConfig(transformations map[string]Transformation) (models.StatelessTransformation, error) {
	statelessConfig := models.StatelessTransformation{Enabled: false}
	if statelessTrans, ok := transformations["stateless_transformation"]; ok {
		if err := json.Unmarshal(statelessTrans.Config, &statelessConfig); err != nil {
			return statelessConfig, fmt.Errorf("unmarshal stateless transformation config: %w", err)
		}
		// Always use the DB row ID — the v2 config blob may store a string alias, not the UUID.
		statelessConfig.ID = statelessTrans.ID
	}
	return statelessConfig, nil
}
