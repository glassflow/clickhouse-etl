package internal

import "time"

type ProcessorMode string

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
	RoleSink         = "sink"
	RoleJoin         = "join"
	RoleIngestor     = "ingestor"
	RoleDeduplicator = "dedup"
	RoleETL          = ""

	// DLQ constants
	DLQDefaultBatchSize = 1
	DLQMaxBatchSize     = 1000
	DLQSuffix           = "DLQ"
	DLQSubjectName      = "failed"

	// JSON schema data types formats
	JSONTypeString  = "string"
	JSONTypeNumber  = "number"
	JSONTypeInteger = "integer"
	JSONTypeBoolean = "boolean"
	JSONTypeNull    = "null"
	JSONTypeArray   = "array"
	JSONTypeObject  = "object"

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
	PublisherSyncInitialRetryDelay = 100 * time.Millisecond
	PublisherSyncMaxRetryDelay     = 1 * time.Second
	PublisherSyncMaxRetryWait      = 1 * time.Minute

	PublisherAsyncInitialRetryDelay = 10 * time.Millisecond
	PublisherAsyncMaxRetryDelay     = 100 * time.Millisecond
	PublisherAsyncMaxRetryWait      = 1 * time.Second

	PublisherMaxPendingAcks = 4000

	// Stream consumer constants
	ConsumerRetries           = 10
	ConsumerInitialRetryDelay = 1 * time.Second
	ConsumerMaxRetryDelay     = 10 * time.Second
	ConsumerMaxWait           = 30 * time.Second

	// NATS client constants
	GlassflowStreamPrefix   = "gf-stream"
	NATSCleanupTimeout      = 5 * time.Second
	NATSConnectionTimeout   = 1 * time.Minute
	NATSConnectionRetries   = 12
	NATSInitialRetryDelay   = 1 * time.Second
	NATSMaxRetryDelay       = 30 * time.Second
	NATSMaxConnectionWait   = 2 * time.Minute
	NATSMaxBufferedMsgs     = 10000
	NatsDefaultFetchMaxWait = 1 * time.Second
	NatsDefaultAckWait      = 60 * time.Second

	// Postgres client constants
	PostgresConnectionRetries = 12
	PostgresInitialRetryDelay = 1 * time.Second
	PostgresMaxRetryDelay     = 30 * time.Second
	PostgresMaxConnectionWait = 2 * time.Minute
	PostgresConnectionTimeout = 1 * time.Minute

	// Kafka consumer constants
	ConsumerGroupNamePrefix = "glassflow-consumer-group"
	ClientID                = "glassflow-consumer"

	// NATS consumer constants
	NATSConsumerNamePrefix = "gf-nats"
	DefaultDialTimeout     = 5000 * time.Millisecond

	// Kafka authentication mechanisms
	MechanismSHA256   = "SCRAM-SHA-256"
	MechanismSHA512   = "SCRAM-SHA-512"
	MechanismKerberos = "GSSAPI"
	MechanismPlain    = "PLAIN"
	MechanismNoAuth   = "NO_AUTH"

	// kafka security protocols
	SASLProtocolPlaintext     = "PLAINTEXT"
	SASLProtocolSASLSSL       = "SASL_SSL"
	SASLProtocolSSL           = "SSL"
	SASLProtocolSASLPlaintext = "SASL_PLAINTEXT"

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
	FetchRetryDelay = 50 * time.Millisecond

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
	SinkDefaultShutdownTimeout      = 5 * time.Second
	DefaultComponentShutdownTimeout = 5 * time.Second

	DefaultDedupComponentBatchSize = 50000
	DefaultDedupMaxWaitTime        = 100 * time.Millisecond

	// Kafka session timeout in milliseconds
	KafkaSessionTimeout = 30000 * time.Millisecond
	// Kafka heartbeat interval in milliseconds
	KafkaHeartbeatInterval = 10000 * time.Millisecond
	// Kafka MinFetchBytes is the minimum amount of data the server should return for a fetch request.
	KafkaMinFetchBytes = 5242880 // 5 MB
	// Kafka MaxFetchBytes is the maximum amount of data the server should return for a fetch request.
	KafkaMaxFetchBytes = 20971520 // 20 MB
	// KafkaMaxQueuedMessagesSize is the maximum number of messages that can be queued in the consumer
	KafkaMaxMessagesInQueueSize = 1048576
	// DefaultKafkaBatchTimeout is default delay of batch collection in kafka ingestor component
	DefaultKafkaBatchTimeout = 5 * time.Second
	// KafkaMaxWait is the maximum time to wait for messages from Kafka
	KafkaMaxWait = 750 * time.Millisecond
	// KafkaMaxPollRecords is the maximum number of records to fetch per poll
	KafkaMaxPollRecords = 5000

	// Kafka message processor modes
	SyncMode             ProcessorMode = "sync"
	AsyncMode            ProcessorMode = "async"
	DefaultProcessorMode               = SyncMode

	// Encryption constants
	AESKeySize = 32
)
