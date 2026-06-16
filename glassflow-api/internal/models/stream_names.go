package models

// PipelineStreamNames is the set of JetStream stream names that exist for a
// given pipeline at runtime. Returned by Orchestrator.GetStreamNames so that
// callers (e.g. usage_stats_collector) can query stream metrics without
// having to know the naming convention themselves.
//
// The naming convention differs between deployment modes:
//   - K8s production: names match what the operator deployed (read from
//     spec.Resolved on the Pipeline CR);
//   - Local mode: names come from the legacy GetIngestorStreamName /
//     GetDedupOutputStreamName / GetJoinedStreamName helpers in this package.
//
// Routing through the Orchestrator means callers don't have to switch on
// mode themselves. T13 S-10 / ETL-1066: closes the bug where the collector
// hard-coded the local-mode naming and silently returned zeros in K8s.
type PipelineStreamNames struct {
	// IngestorStreams is one stream name per Kafka source topic, in topic
	// index order. Empty for OTLP-source pipelines.
	IngestorStreams []string

	// DedupStreams is one stream name per source topic that has dedup
	// enabled. Index aligns with the source topic's index, not a packed
	// position — callers can correlate by topic.
	DedupStreams []DedupStreamName

	// JoinStream is the joined output stream name. Empty when join is
	// disabled.
	JoinStream string

	// DLQStream is the per-pipeline DLQ stream name. Always set.
	DLQStream string
}

// DedupStreamName carries both the source topic index and the resulting
// dedup output stream name so callers can correlate metrics back to a topic.
type DedupStreamName struct {
	TopicIndex int
	StreamName string
}
