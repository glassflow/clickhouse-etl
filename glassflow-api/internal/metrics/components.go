package metrics

import "github.com/prometheus/client_golang/prometheus"

var (
	IngestorRecordsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "ingestor",
			Name:      "records_total",
			Help:      "Total records ingested from Kafka (before dedup).",
		},
		[]string{"topic"},
	)
	IngestorDeduplicatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "ingestor",
			Name:      "deduplicated_total",
			Help:      "Total records dropped due to deduplication window.",
		},
		[]string{"topic"},
	)
	IngestorDLQTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "ingestor",
			Name:      "dlq_total",
			Help:      "Total records sent to DLQ.",
		},
		[]string{"topic"},
	)
	JoinMatchesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "join",
			Name:      "matches_total",
			Help:      "Total join matches produced (rows output).",
		},
		[]string{"output_stream"},
	)
	JoinLeftEventsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "join",
			Name:      "left_events_total",
			Help:      "Left stream events processed.",
		},
		[]string{"left_stream"},
	)
	JoinRightEventsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "join",
			Name:      "right_events_total",
			Help:      "Right stream events processed.",
		},
		[]string{"right_stream"},
	)
	SinkBatchesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "sink",
			Name:      "batches_total",
			Help:      "Total batches flushed to ClickHouse.",
		},
		[]string{"table"},
	)
	SinkBatchesFailedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "sink",
			Name:      "batches_failed_total",
			Help:      "Total batches that failed to flush to ClickHouse.",
		},
		[]string{"table"},
	)
	SinkBatchRecords = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Namespace: "glassflow",
			Subsystem: "sink",
			Name:      "batch_records",
			Help:      "Records per batch.",
			Buckets:   []float64{1, 10, 50, 100, 250, 500, 1000, 5000},
		},
		[]string{"table"},
	)
	SinkRecordsFailedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Namespace: "glassflow",
			Subsystem: "sink",
			Name:      "records_failed_total",
			Help:      "Total individual records that failed during mapping or batch flush.",
		},
		[]string{"table"},
	)
)

func init() {
	Registry.MustRegister(
		IngestorRecordsTotal,
		IngestorDeduplicatedTotal,
		IngestorDLQTotal,
		JoinMatchesTotal,
		JoinLeftEventsTotal,
		JoinRightEventsTotal,
		SinkBatchesTotal,
		SinkBatchesFailedTotal,
		SinkBatchRecords,
		SinkRecordsFailedTotal,
	)
}
