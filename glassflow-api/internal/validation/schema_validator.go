package validation

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/filter"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	tj "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

// DedupKeyConfig holds deduplication configuration for a source
type DedupKeyConfig struct {
	SourceName string
	KeyField   string
}

// JoinKeyConfig holds join configuration for a source
type JoinKeyConfig struct {
	SourceID string
	JoinKey  string
}

// SchemaFieldValidator validates schema fields against pipeline configuration constraints
type SchemaFieldValidator struct {
	dedupKeys                map[string]string
	joinKeys                 map[string]string
	filterConfig             *filterValidationConfig
	statelessTransformations map[string][]models.Transform
	mappingsBySource         map[string][]string // sourceName -> []fieldNames
}

type filterValidationConfig struct {
	enabled    bool
	expression string
	sourceName string
}

// NewSchemaFieldValidator creates a new validator from pipeline configuration
func NewSchemaFieldValidator(
	dedupConfig []DedupKeyConfig,
	joinSources []JoinKeyConfig,
	filterEnabled bool,
	filterExpression string,
	filterSourceName string,
	transformations map[string][]models.Transform,
	mappingFields []models.MappingField,
) *SchemaFieldValidator {
	v := &SchemaFieldValidator{
		dedupKeys:        make(map[string]string),
		joinKeys:         make(map[string]string),
		mappingsBySource: make(map[string][]string),
	}

	// Build deduplication key map
	for _, cfg := range dedupConfig {
		v.dedupKeys[cfg.SourceName] = cfg.KeyField

	}

	// Build join key map
	for _, cfg := range joinSources {
		v.joinKeys[cfg.SourceID] = cfg.JoinKey
	}

	// Configure filter validation
	if filterEnabled {
		v.filterConfig = &filterValidationConfig{
			enabled:    true,
			expression: filterExpression,
			sourceName: filterSourceName,
		}
	}

	if transformations != nil {
		v.statelessTransformations = transformations
	}

	// Build mapping fields by source
	for _, mf := range mappingFields {
		v.mappingsBySource[mf.SourceID] = append(v.mappingsBySource[mf.SourceID], mf.SourceField)
	}

	return v
}

// ValidateSourceFields validates schema fields for a specific source against all configured constraints
// Returns an error describing the first validation failure, or nil if all validations pass
func (v *SchemaFieldValidator) ValidateSourceFields(sourceName string, fields models.SchemaFields) error {
	// Validate deduplication key if configured for this source
	dedupKey, hasDedupKey := v.dedupKeys[sourceName]
	if hasDedupKey && !fields.HasField(dedupKey) {
		return fmt.Errorf("deduplication key '%s' not found in schema fields for source '%s'", dedupKey, sourceName)
	}

	// Validate join key if configured for this source
	joinKey, hasJoinKey := v.joinKeys[sourceName]
	if hasJoinKey && !fields.HasField(joinKey) {
		return fmt.Errorf("join key '%s' not found in schema fields for source '%s'", joinKey, sourceName)
	}

	// Validate filter expression if enabled and this is the filter source
	if v.filterConfig != nil && v.filterConfig.enabled && v.filterConfig.sourceName == sourceName {
		err := filter.ValidateFilterExpressionOnSourceSchema(v.filterConfig.expression, fields)
		if err != nil {
			return fmt.Errorf("filter expression validation failed for source '%s': %w", sourceName, err)
		}
	}

	if v.statelessTransformations != nil {
		err := tj.ValidateTransformationAgainstSchema(v.statelessTransformations[sourceName], fields)
		if err != nil {
			return fmt.Errorf("stateless transformation validation failed for source '%s': %w", sourceName, err)
		}
	}

	// Validate mapping fields exist in schema
	mappingFields, hasMappings := v.mappingsBySource[sourceName]
	if hasMappings {
		for _, fieldName := range mappingFields {
			if !fields.HasField(fieldName) {
				return fmt.Errorf("mapping field '%s' not found in schema fields for source '%s'", fieldName, sourceName)
			}
		}
	}

	return nil
}

// NewValidatorFromPipelineConfig creates a validator from a PipelineConfig model
func NewValidatorFromPipelineConfig(cfg models.PipelineConfig) *SchemaFieldValidator {
	// Build dedup configs from Ingestor topics
	var dedupConfigs []DedupKeyConfig
	for _, topic := range cfg.Ingestor.KafkaTopics {
		if topic.Deduplication.Enabled {
			dedupConfigs = append(dedupConfigs, DedupKeyConfig{
				SourceName: topic.Name,
				KeyField:   topic.Deduplication.ID,
			})
		}
	}

	// Build join configs
	var joinConfigs []JoinKeyConfig
	if cfg.Join.Enabled {
		for _, js := range cfg.Join.Sources {
			joinConfigs = append(joinConfigs, JoinKeyConfig{
				SourceID: js.SourceID,
				JoinKey:  js.JoinKey,
			})
		}
	}

	// Determine filter source name
	filterSourceName := ""
	if cfg.Filter.Enabled && len(cfg.Ingestor.KafkaTopics) == 1 {
		filterSourceName = cfg.Ingestor.KafkaTopics[0].Name
	}

	stTransformations := make(map[string][]models.Transform)
	if cfg.StatelessTransformation.Enabled {
		stTransformations[cfg.Ingestor.KafkaTopics[0].Name] = cfg.StatelessTransformation.Config.Transform
	}

	return NewSchemaFieldValidator(
		dedupConfigs,
		joinConfigs,
		cfg.Filter.Enabled,
		cfg.Filter.Expression,
		filterSourceName,
		stTransformations,
		cfg.Mapping.Fields,
	)
}
