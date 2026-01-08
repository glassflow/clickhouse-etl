package api

import (
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/validation"
)

// SchemaConfigBuilder provides an optimized way to build schema configurations
// from pipeline JSON. This is an alternative implementation to newSchemaConfig
// with better performance and maintainability.
type SchemaConfigBuilder struct {
	pipeline pipelineJSON

	schemas  []models.SchemaV2
	versions []models.SchemaVersion

	versionMap map[string]models.SchemaVersion
}

// NewSchemaConfigBuilder creates a new builder instance
func NewSchemaConfigBuilder(pipeline pipelineJSON) *SchemaConfigBuilder {
	return &SchemaConfigBuilder{
		pipeline:   pipeline,
		schemas:    make([]models.SchemaV2, 0),
		versions:   make([]models.SchemaVersion, 0),
		versionMap: make(map[string]models.SchemaVersion),
	}
}

// Build constructs the complete schema configuration
func (b *SchemaConfigBuilder) Build() (zero1 models.SchemaConfig, zero2 models.Mapping, _ error) {
	// Validate basic requirements
	if len(b.pipeline.SchemaV2.Sources) != len(b.pipeline.Source.Topics) {
		return zero1, zero2, fmt.Errorf("number of schema sources must match number of topics in source")
	}

	// Build schemas in order
	if err := b.buildSourceSchemas(); err != nil {
		return zero1, zero2, fmt.Errorf("build kafka schemas: %w", err)
	}

	// Validate early (before building more schemas)
	if err := b.validateFields(); err != nil {
		return zero1, zero2, err
	}

	// Build sink schema and mappings
	mapping, err := b.buildSinkSchemaAndMapping()
	if err != nil {
		return zero1, zero2, fmt.Errorf("build sink schema: %w", err)
	}

	return models.SchemaConfig{
		Schemas:  b.schemas,
		Versions: b.versions,
	}, mapping, nil
}

// buildSourceSchemas processes all Kafka source schemas
func (b *SchemaConfigBuilder) buildSourceSchemas() error {
	for _, src := range b.pipeline.SchemaV2.Sources {
		schema := models.SchemaV2{
			SourceName: src.ID,
			DataFormat: models.SchemaDataFormatJSON,
			SchemaType: models.SchemaTypeKafka,
		}

		// Configure external or internal schema
		if src.SchemaType == string(models.SchemaConfigTypeExternal) && b.pipeline.Source.SchemaRegistryConfig.URL != "" {
			schema.ExternalSchemaConfig = models.SchemaRegistryConfig{
				Type:            models.SchemaRegistryTypeConfluent,
				CredentialsType: models.CredentialsTypePlain,
				URL:             b.pipeline.Source.SchemaRegistryConfig.URL,
				APIKey:          b.pipeline.Source.SchemaRegistryConfig.Key,
				APISecret:       b.pipeline.Source.SchemaRegistryConfig.Secret,
			}
		} else {
			schema.ConfigType = models.SchemaConfigTypeInternal
		}

		// Build fields
		fields := make([]models.Field, 0, len(src.Fields))
		for _, f := range src.Fields {
			fields = append(fields, models.Field{
				Name: f.Name,
				Type: f.Type,
			})
		}

		// Create version
		version := models.SchemaVersion{
			SchemaID:     src.ID,
			Version:      src.SchemaVersion,
			SchemaFields: models.SchemaFields{Fields: fields},
		}

		// Store in all collections (no final conversion loop needed)
		b.schemas = append(b.schemas, schema)
		b.versions = append(b.versions, version)
		b.versionMap[src.ID] = version
	}

	return nil
}

// validateFields performs all field validations in a single pass
func (b *SchemaConfigBuilder) validateFields() error {
	// Validate filter configuration
	if b.pipeline.Filter.Enabled && len(b.pipeline.Source.Topics) > 1 {
		return fmt.Errorf("filtering supports only one source topic, but %d topics were configured", len(b.pipeline.Source.Topics))
	}

	// Build validator from pipeline configuration
	validator := b.buildValidator()

	// Validate each source's fields
	for sourceName, version := range b.versionMap {
		if err := validator.ValidateSourceFields(sourceName, version.SchemaFields); err != nil {
			return err
		}
	}

	return nil
}

// buildValidator creates a validator from the pipeline configuration
func (b *SchemaConfigBuilder) buildValidator() *validation.SchemaFieldValidator {
	// Build dedup configs from topics
	var dedupConfigs []validation.DedupKeyConfig
	for _, topic := range b.pipeline.Source.Topics {
		if topic.Deduplication.Enabled {
			dedupConfigs = append(dedupConfigs, validation.DedupKeyConfig{
				SourceName: topic.ID,
				KeyField:   topic.Deduplication.ID,
			})
		}
	}

	// Build join configs
	var joinConfigs []validation.JoinKeyConfig
	if b.pipeline.Join.Enabled {
		for _, js := range b.pipeline.Join.Sources {
			joinConfigs = append(joinConfigs, validation.JoinKeyConfig{
				SourceID: js.SourceID,
				JoinKey:  js.JoinKey,
			})
		}
	}

	// Determine filter source name
	filterSourceName := ""
	if b.pipeline.Filter.Enabled && len(b.pipeline.Source.Topics) == 1 {
		filterSourceName = b.pipeline.Source.Topics[0].ID
	}

	// Build mapping fields slice
	var mappingFields []models.MappingField
	for _, m := range b.pipeline.SchemaV2.Mappings {
		// Lookup source version to get field type
		sourceVersion, ok := b.versionMap[m.SourceID]
		if !ok {
			if b.pipeline.StatelessTransformation.Enabled && b.pipeline.StatelessTransformation.ID == m.SourceID {
				// Skip validation for stateless transformation source
				continue
			}
			// Field will be validated later and will fail with proper error
			continue
		}

		sourceField, found := sourceVersion.SchemaFields.GetField(m.Name)
		if !found {
			// Field will be validated later and will fail with proper error
			continue
		}

		mappingFields = append(mappingFields, models.MappingField{
			SourceID:         m.SourceID,
			SourceField:      sourceField.Name,
			SourceType:       sourceField.Type,
			DestinationField: m.Name,
			DestinationType:  m.ColumnType,
		})
	}

	stTransformations := make(map[string][]models.Transform)
	if b.pipeline.StatelessTransformation.Enabled {
		stTransformations[b.pipeline.Source.Topics[0].Topic] = b.pipeline.StatelessTransformation.Config.Transform
	}

	return validation.NewSchemaFieldValidator(
		dedupConfigs,
		joinConfigs,
		b.pipeline.Filter.Enabled,
		b.pipeline.Filter.Expression,
		filterSourceName,
		stTransformations,
		mappingFields,
	)
}

// buildSinkSchemaAndMapping creates the sink schema and mapping configuration
func (b *SchemaConfigBuilder) buildSinkSchemaAndMapping() (models.Mapping, error) {
	if len(b.pipeline.SchemaV2.Mappings) == 0 {
		return models.Mapping{}, fmt.Errorf("at least one schema mapping must be defined")
	}
	// Build mapping fields and validate
	mappingFields, err := b.buildMappingFields()
	if err != nil {
		return models.Mapping{}, err
	}

	// Determine mapping type
	mappingType := "one_to_one"
	if b.pipeline.Join.Enabled {
		mappingType = "many_to_one"
	}

	return models.Mapping{
		Fields: mappingFields,
		Type:   mappingType,
	}, nil
}

// buildMappingFields creates mapping fields and validates them against source schemas
func (b *SchemaConfigBuilder) buildMappingFields() ([]models.MappingField, error) {
	mappingFields := make([]models.MappingField, 0, len(b.pipeline.SchemaV2.Mappings))

	for _, m := range b.pipeline.SchemaV2.Mappings {
		// Lookup source version (cached in map)
		sourceVersion, ok := b.versionMap[m.SourceID]
		if !ok {
			if b.pipeline.StatelessTransformation.Enabled && b.pipeline.StatelessTransformation.ID == m.SourceID {
				// Skip validation for stateless transformation source
				continue
			}
			return nil, fmt.Errorf("mapping source_id '%s' not found in schemas", m.SourceID)
		}

		// Validate field exists
		sourceField, found := sourceVersion.SchemaFields.GetField(m.Name)
		if !found {
			return nil, fmt.Errorf("mapping field '%s' not found in fields for source_id '%s'", m.Name, m.SourceID)
		}

		mappingFields = append(mappingFields, models.MappingField{
			SourceID:         m.SourceID,
			SourceField:      sourceField.Name,
			SourceType:       sourceField.Type,
			DestinationField: m.Name,
			DestinationType:  m.ColumnType,
		})
	}

	return mappingFields, nil
}

func newSchemaConfig(pipeline pipelineJSON) (models.SchemaConfig, models.Mapping, error) {
	builder := NewSchemaConfigBuilder(pipeline)
	return builder.Build()
}
