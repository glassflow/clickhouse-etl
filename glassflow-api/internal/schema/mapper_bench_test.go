package schema

import (
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

var benchmarkJSON = []byte(`{
    "@timestamp": "2026-01-20T17:00:57.740705Z",
    "@version": 1192,
    "account_id": 787123561870312,
    "app_name": "ddd",
    "app_version": "2.0.0",
    "client_ip": "64.138.63.176",
    "cluster_name": "dns.name.here.com",
    "component": "component3",
    "component_type": "api",
    "container.image.name": "dns.name.here:443/aa/aaa:asd-0000-asd-10d1d81a",
    "env_name": "test",
    "extension_id": "",
    "host": "ams02-c01-aaa01.int.rclabenv.com",
    "hostname": "aaa-lkiwhri182-189723i",
    "kubernetes.container.id": "c1e82d7d-9bb8-41e6-838d-07d15ec70ecc",
    "kubernetes.container.name": "app",
    "kubernetes.namespace": "production",
    "kubernetes.pod.name": "aaa-lkiwhri182-189723i",
    "location": "lon01",
    "log_agent": "filebeat",
    "log_format": "xml",
    "log_level": "WARNING",
    "log_type": "security",
    "logger_name": "com.baomidou.dynamic.datasource.DynamicRoutingDataSource",
    "logger_type": "logger",
    "logstash_producer": "ams02-c01-lss01",
    "message": "v=2&cid=775699636.6929331942927&sid=2101773716&sct=3&seg=0&_et=27041&en=click&ep.event_id=1906235448862.9&dt=About%20Us&ul=fr-fr&ur=US-OH",
    "modified_timestamp": false,
    "port": 15265,
    "producer_time": "2026-01-20T17:00:57.740735",
    "request_id": "7612886e-b7d6-4a6b-98f1-c99e7a0bbb1c",
    "request_method": "PATCH",
    "request_uri": "/health",
    "request_user_agent": "Mozilla/5.0",
    "request_x_user_agent": "curl/7.68.0",
    "status_code": "400",
    "tags": [
        "system",
        "security",
        "system",
        "audit",
        "audit"
    ],
    "thread": "health-checker-readOnlyDatabase",
    "timestamp": "2026-01-20T17:00:57.740742",
    "type": "audit"
}`)

func setupBenchmarkMapper(b *testing.B) *JsonToClickHouseMapper {
	b.Helper()

	streamsConfig := map[string]models.StreamSchemaConfig{
		"logs": {
			Fields: []models.StreamDataField{
				{FieldName: "@timestamp", FieldType: "string"},
				{FieldName: "@version", FieldType: "int"},
				{FieldName: "account_id", FieldType: "int"},
				{FieldName: "app_name", FieldType: "string"},
				{FieldName: "app_version", FieldType: "string"},
				{FieldName: "client_ip", FieldType: "string"},
				{FieldName: "cluster_name", FieldType: "string"},
				{FieldName: "component", FieldType: "string"},
				{FieldName: "component_type", FieldType: "string"},
				{FieldName: "container.image.name", FieldType: "string"},
				{FieldName: "env_name", FieldType: "string"},
				{FieldName: "extension_id", FieldType: "string"},
				{FieldName: "host", FieldType: "string"},
				{FieldName: "hostname", FieldType: "string"},
				{FieldName: "kubernetes.container.id", FieldType: "string"},
				{FieldName: "kubernetes.container.name", FieldType: "string"},
				{FieldName: "kubernetes.namespace", FieldType: "string"},
				{FieldName: "kubernetes.pod.name", FieldType: "string"},
				{FieldName: "location", FieldType: "string"},
				{FieldName: "log_agent", FieldType: "string"},
				{FieldName: "log_format", FieldType: "string"},
				{FieldName: "log_level", FieldType: "string"},
				{FieldName: "log_type", FieldType: "string"},
				{FieldName: "logger_name", FieldType: "string"},
				{FieldName: "logger_type", FieldType: "string"},
				{FieldName: "logstash_producer", FieldType: "string"},
				{FieldName: "message", FieldType: "string"},
				{FieldName: "modified_timestamp", FieldType: "bool"},
				{FieldName: "port", FieldType: "int"},
				{FieldName: "producer_time", FieldType: "string"},
				{FieldName: "request_id", FieldType: "string"},
				{FieldName: "request_method", FieldType: "string"},
				{FieldName: "request_uri", FieldType: "string"},
				{FieldName: "request_user_agent", FieldType: "string"},
				{FieldName: "request_x_user_agent", FieldType: "string"},
				{FieldName: "status_code", FieldType: "string"},
				{FieldName: "tags", FieldType: "array"},
				{FieldName: "thread", FieldType: "string"},
				{FieldName: "timestamp", FieldType: "string"},
				{FieldName: "type", FieldType: "string"},
			},
			JoinKeyField: "request_id",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "timestamp", StreamName: "logs", FieldName: "@timestamp", ColumnType: "DateTime64(6)"},
		{ColumnName: "version", StreamName: "logs", FieldName: "@version", ColumnType: "Int32"},
		{ColumnName: "account_id", StreamName: "logs", FieldName: "account_id", ColumnType: "Int64"},
		{ColumnName: "app_name", StreamName: "logs", FieldName: "app_name", ColumnType: "String"},
		{ColumnName: "app_version", StreamName: "logs", FieldName: "app_version", ColumnType: "String"},
		{ColumnName: "client_ip", StreamName: "logs", FieldName: "client_ip", ColumnType: "String"},
		{ColumnName: "cluster_name", StreamName: "logs", FieldName: "cluster_name", ColumnType: "String"},
		{ColumnName: "component", StreamName: "logs", FieldName: "component", ColumnType: "String"},
		{ColumnName: "component_type", StreamName: "logs", FieldName: "component_type", ColumnType: "String"},
		{ColumnName: "container_image_name", StreamName: "logs", FieldName: "container.image.name", ColumnType: "String"},
		{ColumnName: "env_name", StreamName: "logs", FieldName: "env_name", ColumnType: "String"},
		{ColumnName: "extension_id", StreamName: "logs", FieldName: "extension_id", ColumnType: "String"},
		{ColumnName: "host", StreamName: "logs", FieldName: "host", ColumnType: "String"},
		{ColumnName: "hostname", StreamName: "logs", FieldName: "hostname", ColumnType: "String"},
		{ColumnName: "kubernetes_container_id", StreamName: "logs", FieldName: "kubernetes.container.id", ColumnType: "String"},
		{ColumnName: "kubernetes_container_name", StreamName: "logs", FieldName: "kubernetes.container.name", ColumnType: "String"},
		{ColumnName: "kubernetes_namespace", StreamName: "logs", FieldName: "kubernetes.namespace", ColumnType: "String"},
		{ColumnName: "kubernetes_pod_name", StreamName: "logs", FieldName: "kubernetes.pod.name", ColumnType: "String"},
		{ColumnName: "location", StreamName: "logs", FieldName: "location", ColumnType: "String"},
		{ColumnName: "log_agent", StreamName: "logs", FieldName: "log_agent", ColumnType: "String"},
		{ColumnName: "log_format", StreamName: "logs", FieldName: "log_format", ColumnType: "String"},
		{ColumnName: "log_level", StreamName: "logs", FieldName: "log_level", ColumnType: "String"},
		{ColumnName: "log_type", StreamName: "logs", FieldName: "log_type", ColumnType: "String"},
		{ColumnName: "logger_name", StreamName: "logs", FieldName: "logger_name", ColumnType: "String"},
		{ColumnName: "logger_type", StreamName: "logs", FieldName: "logger_type", ColumnType: "String"},
		{ColumnName: "logstash_producer", StreamName: "logs", FieldName: "logstash_producer", ColumnType: "String"},
		{ColumnName: "message", StreamName: "logs", FieldName: "message", ColumnType: "String"},
		{ColumnName: "modified_timestamp", StreamName: "logs", FieldName: "modified_timestamp", ColumnType: "Bool"},
		{ColumnName: "port", StreamName: "logs", FieldName: "port", ColumnType: "Int32"},
		{ColumnName: "producer_time", StreamName: "logs", FieldName: "producer_time", ColumnType: "DateTime64(6)"},
		{ColumnName: "request_id", StreamName: "logs", FieldName: "request_id", ColumnType: "String"},
		{ColumnName: "request_method", StreamName: "logs", FieldName: "request_method", ColumnType: "String"},
		{ColumnName: "request_uri", StreamName: "logs", FieldName: "request_uri", ColumnType: "String"},
		{ColumnName: "request_user_agent", StreamName: "logs", FieldName: "request_user_agent", ColumnType: "String"},
		{ColumnName: "request_x_user_agent", StreamName: "logs", FieldName: "request_x_user_agent", ColumnType: "String"},
		{ColumnName: "status_code", StreamName: "logs", FieldName: "status_code", ColumnType: "String"},
		{ColumnName: "tags", StreamName: "logs", FieldName: "tags", ColumnType: "Array(String)"},
		{ColumnName: "thread", StreamName: "logs", FieldName: "thread", ColumnType: "String"},
		{ColumnName: "event_timestamp", StreamName: "logs", FieldName: "timestamp", ColumnType: "DateTime64(6)"},
		{ColumnName: "type", StreamName: "logs", FieldName: "type", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		b.Fatalf("failed to create mapper: %v", err)
	}

	return mapper
}

func BenchmarkPrepareValues(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ReportAllocs()

	for b.Loop() {
		_, err := mapper.PrepareValues(benchmarkJSON)
		if err != nil {
			b.Fatalf("PrepareValues failed: %v", err)
		}
	}
}

func BenchmarkPrepareValuesStream(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := mapper.PrepareValuesStream("logs", benchmarkJSON)
		if err != nil {
			b.Fatalf("PrepareValuesStream failed: %v", err)
		}
	}
}

func BenchmarkGetJoinKey(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := mapper.GetJoinKey("logs", benchmarkJSON)
		if err != nil {
			b.Fatalf("GetJoinKey failed: %v", err)
		}
	}
}

func BenchmarkGetFieldsMap(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := mapper.GetFieldsMap("logs", benchmarkJSON)
		if err != nil {
			b.Fatalf("GetFieldsMap failed: %v", err)
		}
	}
}

func BenchmarkValidateSchema(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		err := mapper.ValidateSchema("logs", benchmarkJSON)
		if err != nil {
			b.Fatalf("ValidateSchema failed: %v", err)
		}
	}
}

func BenchmarkGetKey(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := mapper.GetKey("logs", "request_id", benchmarkJSON)
		if err != nil {
			b.Fatalf("GetKey failed: %v", err)
		}
	}
}

func BenchmarkJoinData(b *testing.B) {
	// Setup a mapper with two streams for join testing
	streamsConfig := map[string]models.StreamSchemaConfig{
		"left_stream": {
			Fields: []models.StreamDataField{
				{FieldName: "request_id", FieldType: "string"},
				{FieldName: "app_name", FieldType: "string"},
				{FieldName: "message", FieldType: "string"},
			},
			JoinKeyField:    "request_id",
			JoinOrientation: "left",
		},
		"right_stream": {
			Fields: []models.StreamDataField{
				{FieldName: "request_id", FieldType: "string"},
				{FieldName: "status_code", FieldType: "string"},
				{FieldName: "client_ip", FieldType: "string"},
			},
			JoinKeyField:    "request_id",
			JoinOrientation: "right",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "request_id", StreamName: "left_stream", FieldName: "request_id", ColumnType: "String"},
		{ColumnName: "app_name", StreamName: "left_stream", FieldName: "app_name", ColumnType: "String"},
		{ColumnName: "message", StreamName: "left_stream", FieldName: "message", ColumnType: "String"},
		{ColumnName: "status_code", StreamName: "right_stream", FieldName: "status_code", ColumnType: "String"},
		{ColumnName: "client_ip", StreamName: "right_stream", FieldName: "client_ip", ColumnType: "String"},
	}

	mapper, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
	if err != nil {
		b.Fatalf("failed to create mapper: %v", err)
	}

	leftData := []byte(`{"request_id": "7612886e-b7d6-4a6b-98f1-c99e7a0bbb1c", "app_name": "ddd", "message": "test message"}`)
	rightData := []byte(`{"request_id": "7612886e-b7d6-4a6b-98f1-c99e7a0bbb1c", "status_code": "400", "client_ip": "64.138.63.176"}`)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := mapper.JoinData("left_stream", leftData, "right_stream", rightData)
		if err != nil {
			b.Fatalf("JoinData failed: %v", err)
		}
	}
}

// BenchmarkGetOrderedColumns measures the performance of getting ordered columns
func BenchmarkGetOrderedColumns(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = mapper.GetOrderedColumns()
	}
}

// BenchmarkGetOrderedColumnsStream measures the performance of getting ordered columns for a stream
func BenchmarkGetOrderedColumnsStream(b *testing.B) {
	mapper := setupBenchmarkMapper(b)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_ = mapper.GetOrderedColumnsStream("logs")
	}
}

// BenchmarkNewJSONToClickHouseMapper measures mapper creation time
func BenchmarkNewJSONToClickHouseMapper(b *testing.B) {
	streamsConfig := map[string]models.StreamSchemaConfig{
		"logs": {
			Fields: []models.StreamDataField{
				{FieldName: "@timestamp", FieldType: "string"},
				{FieldName: "@version", FieldType: "int"},
				{FieldName: "account_id", FieldType: "int"},
				{FieldName: "app_name", FieldType: "string"},
				{FieldName: "message", FieldType: "string"},
				{FieldName: "request_id", FieldType: "string"},
				{FieldName: "tags", FieldType: "array"},
			},
			JoinKeyField: "request_id",
		},
	}

	sinkMappingConfig := []models.SinkMappingConfig{
		{ColumnName: "timestamp", StreamName: "logs", FieldName: "@timestamp", ColumnType: "DateTime64(6)"},
		{ColumnName: "version", StreamName: "logs", FieldName: "@version", ColumnType: "Int32"},
		{ColumnName: "account_id", StreamName: "logs", FieldName: "account_id", ColumnType: "Int64"},
		{ColumnName: "app_name", StreamName: "logs", FieldName: "app_name", ColumnType: "String"},
		{ColumnName: "message", StreamName: "logs", FieldName: "message", ColumnType: "String"},
		{ColumnName: "request_id", StreamName: "logs", FieldName: "request_id", ColumnType: "String"},
		{ColumnName: "tags", StreamName: "logs", FieldName: "tags", ColumnType: "Array(String)"},
	}

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, err := NewJSONToClickHouseMapper(streamsConfig, sinkMappingConfig)
		if err != nil {
			b.Fatalf("failed to create mapper: %v", err)
		}
	}
}