package internal

import "time"

// Default values
const (
	DefaultSubjectName = "input"
	WildcardSubject    = "*"

	// Component types
	KafkaIngestorType        = "kafka"
	TemporalJoinType         = "temporal"
	SchemaMapperJSONToCHType = "jsonToClickhouse"
	ClickHouseSinkType       = "clickhouse"

	// Stream naming constants
	MaxStreamNameLength  = 32
	PipelineStreamPrefix = "gf"

	// Pipeline status constants
	PipelineStatusCreated     = "Created"
	PipelineStatusRunning     = "Running"
	PipelineStatusResuming    = "Resuming"
	PipelineStatusTerminating = "Terminating"
	PipelineStatusFailed      = "Failed"
	PipelineStatusStopping    = "Stopping"
	PipelineStatusStopped     = "Stopped"

	// Consumer group offset constants
	InitialOffsetEarliest = "earliest"
	InitialOffsetLatest   = "latest"

	// Join orientation constants
	JoinLeft  = "left"
	JoinRight = "right"

	// Transformation type constants
	JoinTransformation      = "Join"
	DedupJoinTransformation = "Join & Deduplication"
	DedupTransformation     = "Deduplication"
	IngestTransformation    = "Ingest Only"

	// Role constants
	RoleSink     = "sink"
	RoleJoin     = "join"
	RoleIngestor = "ingestor"
	RoleETL      = ""

	// DLQ constants
	DLQMaxBatchSize     = 100
	DLQSuffix           = "DLQ"
	DLQSubjectName      = "failed"
	DLQDefaultBatchSize = 1

	// Kafka data type constants
	KafkaTypeString  = "string"
	KafkaTypeBool    = "bool"
	KafkaTypeInt     = "int"
	KafkaTypeInt8    = "int8"
	KafkaTypeInt16   = "int16"
	KafkaTypeInt32   = "int32"
	KafkaTypeInt64   = "int64"
	KafkaTypeUint    = "uint"
	KafkaTypeUint8   = "uint8"
	KafkaTypeUint16  = "uint16"
	KafkaTypeUint32  = "uint32"
	KafkaTypeUint64  = "uint64"
	KafkaTypeFloat   = "float"
	KafkaTypeFloat32 = "float32"
	KafkaTypeFloat64 = "float64"
	KafkaTypeBytes   = "bytes"
	KafkaTypeArray   = "array"
	KafkaTypeMap     = "map"

	// ClickHouse data type constants
	CHTypeString     = "String"
	CHTypeFString    = "FixedString"
	CHTypeBool       = "Bool"
	CHTypeInt8       = "Int8"
	CHTypeInt16      = "Int16"
	CHTypeInt32      = "Int32"
	CHTypeInt64      = "Int64"
	CHTypeLCInt8     = "LowCardinality(Int8)"
	CHTypeLCInt16    = "LowCardinality(Int16)"
	CHTypeLCInt32    = "LowCardinality(Int32)"
	CHTypeLCInt64    = "LowCardinality(Int64)"
	CHTypeUInt8      = "UInt8"
	CHTypeUInt16     = "UInt16"
	CHTypeUInt32     = "UInt32"
	CHTypeUInt64     = "UInt64"
	CHTypeLCUInt8    = "LowCardinality(UInt8)"
	CHTypeLCUInt16   = "LowCardinality(UInt16)"
	CHTypeLCUInt32   = "LowCardinality(UInt32)"
	CHTypeLCUInt64   = "LowCardinality(UInt64)"
	CHTypeFloat32    = "Float32"
	CHTypeFloat64    = "Float64"
	CHTypeLCFloat32  = "LowCardinality(Float32)"
	CHTypeLCFloat64  = "LowCardinality(Float64)"
	CHTypeEnum8      = "Enum8"
	CHTypeEnum16     = "Enum16"
	CHTypeDateTime   = "DateTime"
	CHTypeDateTime64 = "DateTime64"
	CHTypeUUID       = "UUID"
	CHTypeLCString   = "LowCardinality(String)"
	CHTypeLCFString  = "LowCardinality(FixedString)"
	CHTypeLCDateTime = "LowCardinality(DateTime)"

	// Stream publisher constants
	PublisherInitialRetryDelay = 1 * time.Second
	PublisherMaxRetryDelay     = 10 * time.Second
	PublisherMaxRetryWait      = 5 * time.Minute

	// Stream consumer constants
	ConsumerRetries           = 10
	ConsumerInitialRetryDelay = 1 * time.Second
	ConsumerMaxRetryDelay     = 10 * time.Second
	ConsumerMaxWait           = 30 * time.Second

	// NATS client constants
	GlassflowStreamPrefix = "gf-stream"
	NATSCleanupTimeout    = 5 * time.Second
	NATSConnectionTimeout = 1 * time.Minute
	NATSConnectionRetries = 12
	NATSInitialRetryDelay = 1 * time.Second
	NATSMaxRetryDelay     = 30 * time.Second
	NATSMaxConnectionWait = 2 * time.Minute

	// Kafka consumer constants
	ConsumerGroupNamePrefix = "glassflow-consumer-group"
	ClientID                = "glassflow-consumer"

	// NATS consumer constants
	NATSConsumerNamePrefix = "gf-nats"
	DefaultDialTimeout     = 5000 * time.Millisecond
	MechanismSHA256        = "SCRAM-SHA-256"
	MechanismSHA512        = "SCRAM-SHA-512"

	// Ingestor constants
	IngestorInitialRetryDelay = 500 * time.Millisecond
	IngestorMaxRetryDelay     = 5 * time.Second
	IngestorMaxRetryWait      = 10 * time.Minute

	// Orchestrator constants
	ShutdownTimeout = 30 * time.Second

	// Join constants
	MaxStreamsSupportedWithJoin = 2

	// RunnersWatcher constants
	RunnerWatcherInterval = 5 * time.Second
	RunnerRestartDelay    = 2 * time.Second

	// DefaultReplicasCount is the default number of replicas for the component
	DefaultReplicasCount = 1

	// FetchRetryDelay is the delay between retries when fetching messages from NATS stream
	FetchRetryDelay = 100 * time.Millisecond

	// Kubernetes annotation constants for pipeline operations
	PipelineFinalizerName           = "pipeline.etl.glassflow.io/finalizer"
	PipelineCreateAnnotation        = "pipeline.etl.glassflow.io/create"
	PipelineResumeAnnotation        = "pipeline.etl.glassflow.io/resume"
	PipelineStopAnnotation          = "pipeline.etl.glassflow.io/stop"
	PipelineTerminateAnnotation     = "pipeline.etl.glassflow.io/terminate"
	PipelineDeleteAnnotation        = "pipeline.etl.glassflow.io/delete"
	PipelineEditAnnotation          = "pipeline.etl.glassflow.io/edit"
	PipelineHelmUninstallAnnotation = "pipeline.etl.glassflow.io/helm-uninstall"
	PipelinePauseAnnotation         = "pipeline.etl.glassflow.io/pause"

	// SinkDefaultBatchMaxDelayTime is the maximum time to wait before flushing a partial batch to ClickHouse.
	SinkDefaultBatchMaxDelayTime = 60 * time.Second
	// SinkDefaultShutdownTimeout is the maximum time allowed for graceful shutdown and final batch flush.
	SinkDefaultShutdownTimeout = 5 * time.Second

	// Kerberos GSSAPI Auth Mechanisms
	MechanismKerberos = "GSSAPI"
)
