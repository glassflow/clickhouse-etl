package models

import (
	"time"
)

// CredentialType defines how credentials are stored
type CredentialsType string

const (
	CredentialsTypePlain CredentialsType = "plain"
	CredentialsTypeVault CredentialsType = "vault"
)

// SchemaDataFormat defines the data serialization format
type SchemaDataFormat string

const (
	SchemaDataFormatJSON     SchemaDataFormat = "json"
	SchemaDataFormatAVRO     SchemaDataFormat = "avro"
	SchemaDataFormatProtobuf SchemaDataFormat = "protobuf"
)

// SchemaConfigType defines whether the schema is managed internally or externally
type SchemaConfigType string

const (
	SchemaConfigTypeInternal SchemaConfigType = "internal"
	SchemaConfigTypeExternal SchemaConfigType = "external"
)

// SchemaType defines the type of message broker or database
type SchemaType string

const (
	SchemaTypeKafka      SchemaType = "kafka"
	SchemaTypeNATS       SchemaType = "nats"
	SchemaTypeClickHouse SchemaType = "clickhouse"
)

// SchemaRegistryType defines the type of schema registry
type SchemaRegistryType string

const (
	SchemaRegistryTypeConfluent SchemaRegistryType = "confluent"
)

// MappingOrintation defines the orientation of the schema mapping
type MappingOrintation string

const (
	MappingOrientationSource      MappingOrintation = "source"
	MappingOrientationDestination MappingOrintation = "destination"
)

type SchemaRegistryConfig struct {
	Type            SchemaRegistryType `json:"type"`
	URL             string             `json:"url"`
	CredentialsType CredentialsType    `json:"credentials_type"`
	APIKey          string             `json:"api_key,omitempty"`
	APISecret       string             `json:"api_secret,omitempty"`
}

type SchemaV2 struct {
	ID                   string               `json:"id" db:"id"`
	SourceName           string               `json:"source_name" db:"Source_name"`
	ConfigType           SchemaConfigType     `json:"config_type" db:"config_type"`
	ExternalSchemaConfig SchemaRegistryConfig `json:"external_schema_config" db:"external_schema_config"`
	DataFormat           SchemaDataFormat     `json:"data_format" db:"data_format"`
	SchemaType           SchemaType           `json:"schema_type" db:"schema_type"`
}

// SchemaVersion represents a versioned schema definition
type SchemaVersion struct {
	ID           string       `json:"id" db:"id"`
	SchemaID     string       `json:"schema_id" db:"schema_id"`
	Version      string       `json:"version" db:"version"`
	Status       string       `json:"status" db:"status"`
	SchemaFields SchemaFields `json:"schema_fields" db:"schema_fields"`
	CreatedAt    time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at" db:"updated_at"`
}

type Mapping struct {
	ID         string         `json:"id" db:"id"`
	Type       string         `json:"mapping_type" db:"mapping_type"`
	Fields     []MappingField `json:"mapping_fields" db:"mapping_fields"`
	PipelineID string         `json:"pipeline_id" db:"pipeline_id"`
	CreatedAt  time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at" db:"updated_at"`
}

type Field struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type SchemaFields struct {
	Fields []Field `json:"fields"`
}

func (sf SchemaFields) HasField(name string) bool {
	for _, field := range sf.Fields {
		if field.Name == name {
			return true
		}
	}
	return false
}

func (sf SchemaFields) GetField(name string) (*Field, bool) {
	for _, field := range sf.Fields {
		if field.Name == name {
			return &field, true
		}
	}

	return nil, false
}

type MappingField struct {
	SourceID         string `json:"source_id"`
	SourceField      string `json:"source_field"`
	SourceType       string `json:"source_type"`
	DestinationField string `json:"destination_field"`
	DestinationType  string `json:"destination_type"`
}

type SchemaConfig struct {
	Schemas  []SchemaV2      `json:"schemas"`
	Versions []SchemaVersion `json:"versions"`
}
