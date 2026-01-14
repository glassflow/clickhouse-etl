package models

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

type SchemaRegistryConfig struct {
	URL       string `json:"url"`
	APIKey    string `json:"api_key,omitempty"`
	APISecret string `json:"api_secret,omitempty"`
}

// SchemaVersion represents a versioned schema definition
type SchemaVersion struct {
	SourceID  string  `json:"source_id" db:"source_id"`
	VersionID string  `json:"version_id" db:"version_id"`
	DataType  string  `json:"data_type" db:"data_type"`
	Fields    []Field `json:"fields" db:"fields"`
}

type Field struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

type SchemaFields struct {
	Fields []Field `json:"fields"`
}
