package registry

import (
	"context"
	"errors"
	"fmt"

	"github.com/tidwall/gjson"
	"github.com/twmb/franz-go/pkg/sr"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type SchemaRegistryClient struct {
	client *sr.Client
}

func NewSchemaRegistryClient(config models.SchemaRegistryConfig) (*SchemaRegistryClient, error) {
	opts := []sr.ClientOpt{sr.URLs(config.URL)}

	if config.APIKey != "" && config.APISecret != "" {
		opts = append(opts, sr.BasicAuth(config.APIKey, config.APISecret))
	}

	client, err := sr.NewClient(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create the Schema Registry client: %w", err)
	}

	return &SchemaRegistryClient{
		client: client,
	}, nil
}

func (s *SchemaRegistryClient) GetSchema(ctx context.Context, schemaID int) ([]models.Field, error) {
	schema, err := s.client.SchemaByID(ctx, schemaID)
	if err != nil {
		if errors.Is(err, sr.ErrSchemaNotFound) {
			return nil, models.ErrSchemaNotFound
		}
		return nil, fmt.Errorf("failed to get schema by id %d: %w", schemaID, err)
	}

	if schema.Type != sr.TypeJSON {
		return nil, fmt.Errorf("%w: expected %s, got %s", models.ErrUnexpectedSchemaFormat, sr.TypeJSON, schema.Type)
	}

	return parseJSONSchema(schema.Schema)
}

func parseJSONSchema(schema string) ([]models.Field, error) {
	schemaType := gjson.Get(schema, "type")
	if !schemaType.Exists() || schemaType.String() != "object" {
		return nil, models.ErrInvalidSchema
	}

	properties := gjson.Get(schema, "properties")
	additionalProperties := gjson.Get(schema, "additionalProperties")
	if !properties.Exists() && !additionalProperties.Exists() {
		return nil, models.ErrInvalidSchema
	}

	fields := make([]models.Field, 0)
	if properties.Exists() {
		propertiesFields := extractFieldTypes(properties)
		fields = append(fields, propertiesFields...)
	}

	if additionalProperties.Exists() {
		additionalFields := extractFieldTypes(additionalProperties)
		fields = append(fields, additionalFields...)
	}

	return fields, nil
}

func extractFieldTypes(properties gjson.Result) []models.Field {
	fields := make([]models.Field, 0)
	properties.ForEach(func(key, value gjson.Result) bool {
		fieldType := value.Get("type")
		if !fieldType.Exists() {
			return true
		}
		dataType, err := resolveJSONSchemaType(value)
		if err != nil {
			return true
		}
		if dataType == internal.KafkaTypeMap {
			nestedFields, err := parseJSONSchema(value.Raw)
			if err != nil {
				return true
			}

			for _, field := range nestedFields {
				combinedName := fmt.Sprintf("%s.%s", key.String(), field.Name)
				fields = append(fields, models.Field{Name: combinedName, Type: field.Type})
			}

			return true
		}

		fields = append(fields, models.Field{
			Name: key.String(),
			Type: dataType,
		})
		return true
	})

	return fields
}

func resolveJSONSchemaType(property gjson.Result) (string, error) {
	typeField := property.Get("type")

	if !typeField.Exists() {
		return "", models.ErrUnsupportedDataType
	}

	switch typeField.String() {
	case internal.JSONTypeArray:
		return internal.KafkaTypeArray, nil
	case internal.JSONTypeObject:
		return internal.KafkaTypeMap, nil
	case internal.JSONTypeString:
		return internal.KafkaTypeString, nil
	case internal.JSONTypeInteger:
		return internal.KafkaTypeInt, nil
	case internal.JSONTypeNumber:
		return internal.KafkaTypeFloat, nil
	case internal.JSONTypeBoolean:
		return internal.KafkaTypeBool, nil
	default:
		return "", models.ErrUnsupportedDataType
	}
}
