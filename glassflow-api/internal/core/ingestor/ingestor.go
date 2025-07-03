package ingestor

import (
	"context"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Config struct {
	KafkaConnectionConfig *models.KafkaConfig
	TopicName             string
	NATSStreamName        string
	NATSSubjectName       string
}

type Ingestor interface {
	Start(ctx context.Context) error
	Stop(noWait bool)
}
