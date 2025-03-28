package api

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type pipelineRequest struct {
	Brokers []string    `json:"kafka_brokers"`
	Topics  []topicData `json:"kafka_topics"`

	// kafka auth
	IAMEnable     bool   `json:"kafka_iam_enable"`
	IAMRegion     string `json:"kafka_iam_region"`
	SASLUser      string `json:"kafka_sasl_user"`
	SASLPassword  string `json:"kafka_sasl_password"`
	SASLMechanism string `json:"kafka_sasl_mechanism"`
	SASLTLSEnable bool   `json:"kafka_sasl_tls_enable"`
}

type topicData struct {
	Topic                      string          `json:"kafka_topic"`
	DedupKey                   string          `json:"kafka_dedup_key"`
	DedupKeyType               string          `json:"kafka_dedup_key_type"`
	DedupWindow                models.Duration `json:"dedup_window"`
	ConsumerGroupInitialOffset string          `json:"consumer_group_initial_offset"`
}

func (h *handler) startBridge(w http.ResponseWriter, r *http.Request) {
	req, err := parseRequest[pipelineRequest](w, r)
	if err != nil {
		var jsonErr *invalidJSONError
		if errors.As(err, jsonErr) {
			jsonError(w, http.StatusBadRequest, err.Error(), nil)
		} else {
			h.log.Error("failed to read create pipeline request", slog.Any("error", err))
			serverError(w)
		}
		return
	}

	topics := make([]*models.TopicConfig, len(req.Topics))

	for i, t := range req.Topics {
		//nolint: exhaustruct // consumer group id will be set internally
		topic := &models.TopicConfig{
			Name:                       t.Topic,
			DedupWindow:                t.DedupWindow,
			DedupKey:                   t.DedupKey,
			DedupKeyType:               t.DedupKeyType,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
		}
		topics[i] = topic
	}

	err = h.bridgeManager.SetupBridges(
		&models.KafkaConfig{
			Brokers:       req.Brokers,
			IAMEnable:     req.IAMEnable,
			IAMRegion:     req.IAMRegion,
			SASLUser:      req.SASLUser,
			SASLPassword:  req.SASLPassword,
			SASLMechanism: req.SASLMechanism,
			SASLTLSEnable: req.SASLTLSEnable,
		},
		topics,
	)
	if err != nil {
		h.log.Error("failed to read create pipeline request", slog.Any("error", err))
		serverError(w)
	}

	w.WriteHeader(http.StatusCreated)
}
