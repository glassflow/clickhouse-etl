package processor

import (
	"context"
	"errors"
	"log/slog"
	"testing"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"

	"github.com/glassflow/clickhouse-etl/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl/glassflow-api/pkg/observability"
)

func TestComponent_WriteFailedBatch_RecordsDLQMetric(t *testing.T) {
	reader := observability.InitMetricsForTesting()

	dlq := &stubWriter{calls: [][]models.FailedMessage{nil}}
	c := &Component{
		dlqWriter: dlq,
		log:       slog.Default(),
		role:      "dedup",
		shutdown:  shutdown{doneCh: make(chan struct{})},
	}

	failed := []models.FailedMessage{
		{Message: makeMsg(`{"id":1}`), Error: errors.New("processing error")},
		{Message: makeMsg(`{"id":2}`), Error: errors.New("another error")},
	}

	err := c.writeFailedBatch(context.Background(), failed)
	require.NoError(t, err)

	var rm metricdata.ResourceMetrics
	require.NoError(t, reader.Collect(context.Background(), &rm))

	found := false
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			if m.Name != observability.GfMetricPrefix+"_dlq_records_written_total" {
				continue
			}
			sum, ok := m.Data.(metricdata.Sum[int64])
			if !ok {
				continue
			}
			for _, dp := range sum.DataPoints {
				comp, _ := dp.Attributes.Value("component")
				reason, _ := dp.Attributes.Value("reason")
				if comp.AsString() == "dedup" && reason.AsString() == observability.DLQReasonUnrecoverable {
					require.Equal(t, int64(2), dp.Value)
					found = true
				}
			}
		}
	}
	require.True(t, found, "dlq_records_written_total metric not recorded for component=dedup")
}
