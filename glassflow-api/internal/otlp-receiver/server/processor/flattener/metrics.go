package flattener

import (
	"encoding/json"
	"fmt"

	colmetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	metricsv1 "go.opentelemetry.io/proto/otlp/metrics/v1"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

func FlattenMetrics(req *colmetricspb.ExportMetricsServiceRequest) ([]models.Message, error) {
	var messages []models.Message
	for _, rm := range req.GetResourceMetrics() {
		resource := attrsToMap(rm.GetResource().GetAttributes())
		for _, sm := range rm.GetScopeMetrics() {
			scope := sm.GetScope()
			scopeAttrs := attrsToMap(scope.GetAttributes())
			for _, m := range sm.GetMetrics() {
				msgs, err := flattenMetricDataPoints(m, resource, scope.GetName(), scope.GetVersion(), scopeAttrs)
				if err != nil {
					return nil, err
				}
				messages = append(messages, msgs...)
			}
		}
	}
	return messages, nil
}

func flattenMetricDataPoints(
	m *metricsv1.Metric,
	resource map[string]string,
	scopeName, scopeVersion string,
	scopeAttrs map[string]string,
) ([]models.Message, error) {
	base := models.OTLPMetric{
		MetricName:        m.GetName(),
		MetricDescription: m.GetDescription(),
		MetricUnit:        m.GetUnit(),
		ResourceAttributes: resource,
		ScopeName:         scopeName,
		ScopeVersion:      scopeVersion,
		ScopeAttributes:   scopeAttrs,
		BucketCounts:      []uint64{},
		ExplicitBounds:    []float64{},
	}

	switch data := m.GetData().(type) {
	case *metricsv1.Metric_Gauge:
		return flattenNumberDataPoints("gauge", nil, nil, data.Gauge.GetDataPoints(), base)
	case *metricsv1.Metric_Sum:
		t := aggregationTemporalityToString(data.Sum.GetAggregationTemporality())
		mono := data.Sum.GetIsMonotonic()
		return flattenNumberDataPoints("sum", &t, &mono, data.Sum.GetDataPoints(), base)
	case *metricsv1.Metric_Histogram:
		t := aggregationTemporalityToString(data.Histogram.GetAggregationTemporality())
		return flattenHistogramDataPoints(data.Histogram.GetDataPoints(), &t, base)
	case *metricsv1.Metric_ExponentialHistogram:
		t := aggregationTemporalityToString(data.ExponentialHistogram.GetAggregationTemporality())
		return flattenExponentialHistogramDataPoints(data.ExponentialHistogram.GetDataPoints(), &t, base)
	case *metricsv1.Metric_Summary:
		return flattenSummaryDataPoints(data.Summary.GetDataPoints(), base)
	}
	return nil, nil
}

func flattenNumberDataPoints(
	metricType string,
	aggregationTemporality *string,
	isMonotonic *bool,
	points []*metricsv1.NumberDataPoint,
	base models.OTLPMetric,
) ([]models.Message, error) {
	messages := make([]models.Message, 0, len(points))
	for _, dp := range points {
		rec := base
		rec.MetricType = metricType
		rec.AggregationTemporality = aggregationTemporality
		rec.IsMonotonic = isMonotonic
		rec.Timestamp = unixNanoToRFC3339(dp.GetTimeUnixNano())
		rec.StartTimestamp = unixNanoToRFC3339(dp.GetStartTimeUnixNano())
		rec.Flags = dp.GetFlags()
		rec.Attributes = attrsToMap(dp.GetAttributes())
		switch v := dp.GetValue().(type) {
		case *metricsv1.NumberDataPoint_AsDouble:
			rec.ValueDouble = &v.AsDouble
		case *metricsv1.NumberDataPoint_AsInt:
			rec.ValueInt = &v.AsInt
		}
		payload, err := json.Marshal(rec)
		if err != nil {
			return nil, fmt.Errorf("marshal metric data point: %w", err)
		}
		messages = append(messages, models.NewNatsMessage(payload, nil))
	}
	return messages, nil
}

func flattenHistogramDataPoints(
	points []*metricsv1.HistogramDataPoint,
	aggregationTemporality *string,
	base models.OTLPMetric,
) ([]models.Message, error) {
	messages := make([]models.Message, 0, len(points))
	for _, dp := range points {
		rec := base
		rec.MetricType = "histogram"
		rec.AggregationTemporality = aggregationTemporality
		rec.Timestamp = unixNanoToRFC3339(dp.GetTimeUnixNano())
		rec.StartTimestamp = unixNanoToRFC3339(dp.GetStartTimeUnixNano())
		rec.Flags = dp.GetFlags()
		rec.Attributes = attrsToMap(dp.GetAttributes())
		count := dp.GetCount()
		rec.Count = &count
		sum := dp.GetSum()
		rec.Sum = &sum
		if dp.Min != nil {
			min := dp.GetMin()
			rec.Min = &min
		}
		if dp.Max != nil {
			max := dp.GetMax()
			rec.Max = &max
		}
		rec.BucketCounts = dp.GetBucketCounts()
		if rec.BucketCounts == nil {
			rec.BucketCounts = []uint64{}
		}
		rec.ExplicitBounds = dp.GetExplicitBounds()
		if rec.ExplicitBounds == nil {
			rec.ExplicitBounds = []float64{}
		}
		payload, err := json.Marshal(rec)
		if err != nil {
			return nil, fmt.Errorf("marshal histogram data point: %w", err)
		}
		messages = append(messages, models.NewNatsMessage(payload, nil))
	}
	return messages, nil
}

func flattenExponentialHistogramDataPoints(
	points []*metricsv1.ExponentialHistogramDataPoint,
	aggregationTemporality *string,
	base models.OTLPMetric,
) ([]models.Message, error) {
	messages := make([]models.Message, 0, len(points))
	for _, dp := range points {
		rec := base
		rec.MetricType = "exp_histogram"
		rec.AggregationTemporality = aggregationTemporality
		rec.Timestamp = unixNanoToRFC3339(dp.GetTimeUnixNano())
		rec.StartTimestamp = unixNanoToRFC3339(dp.GetStartTimeUnixNano())
		rec.Flags = dp.GetFlags()
		rec.Attributes = attrsToMap(dp.GetAttributes())
		count := dp.GetCount()
		rec.Count = &count
		sum := dp.GetSum()
		rec.Sum = &sum
		if dp.Min != nil {
			min := dp.GetMin()
			rec.Min = &min
		}
		if dp.Max != nil {
			max := dp.GetMax()
			rec.Max = &max
		}
		payload, err := json.Marshal(rec)
		if err != nil {
			return nil, fmt.Errorf("marshal exp_histogram data point: %w", err)
		}
		messages = append(messages, models.NewNatsMessage(payload, nil))
	}
	return messages, nil
}

func flattenSummaryDataPoints(
	points []*metricsv1.SummaryDataPoint,
	base models.OTLPMetric,
) ([]models.Message, error) {
	messages := make([]models.Message, 0, len(points))
	for _, dp := range points {
		rec := base
		rec.MetricType = "summary"
		rec.Timestamp = unixNanoToRFC3339(dp.GetTimeUnixNano())
		rec.StartTimestamp = unixNanoToRFC3339(dp.GetStartTimeUnixNano())
		rec.Flags = dp.GetFlags()
		rec.Attributes = attrsToMap(dp.GetAttributes())
		count := dp.GetCount()
		rec.Count = &count
		sum := dp.GetSum()
		rec.Sum = &sum
		payload, err := json.Marshal(rec)
		if err != nil {
			return nil, fmt.Errorf("marshal summary data point: %w", err)
		}
		messages = append(messages, models.NewNatsMessage(payload, nil))
	}
	return messages, nil
}

func aggregationTemporalityToString(t metricsv1.AggregationTemporality) string {
	switch t {
	case metricsv1.AggregationTemporality_AGGREGATION_TEMPORALITY_DELTA:
		return "DELTA"
	case metricsv1.AggregationTemporality_AGGREGATION_TEMPORALITY_CUMULATIVE:
		return "CUMULATIVE"
	default:
		return "UNSPECIFIED"
	}
}
