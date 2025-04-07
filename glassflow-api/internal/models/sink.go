package models

type SchemaMapper struct {
	Streams     map[string]StreamSchema
	SinkMapping []SchemaMapperMapping
}

type SchemaMapperMapping struct {
	ColumnName string
	ColumnType string

	StreamName string
	FieldName  string
}

type StreamSchema struct {
	Fields []struct {
		FieldName string
		FieldType string
	}
	JoinKey string
}

type Clickhouse struct {
	Address  string
	Database string
	Username string
	Password string
	Table    string
}
