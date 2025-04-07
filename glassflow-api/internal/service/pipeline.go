package service

import (
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type PipelineManager struct {
	BridgeRunner *BridgeManager
	Log          *slog.Logger
}

func NewPipelineManager(bridgeRunner *BridgeManager, log *slog.Logger) *PipelineManager {
	return &PipelineManager{
		BridgeRunner: bridgeRunner,
		Log:          log,
	}
}

var ErrUnsupportedNumberOfTopics = errors.New("unsupported number of topics")

const (
	MaxStreamsSupportedWithJoin    = 2
	MinStreamsSupportedWithoutJoin = 1
	ShutdownTimeout                = 30 * time.Second
)

func (p *PipelineManager) SetupPipeline(spec *models.PipelineRequest) error {
	// create the streams if they are correct number
	if spec.Join.Enabled && len(spec.Source.Topics) != MaxStreamsSupportedWithJoin {
		//nolint: wrapcheck // custom internal errors
		return ErrUnsupportedNumberOfTopics
	} else if len(spec.Source.Topics) != MinStreamsSupportedWithoutJoin {
		//nolint: wrapcheck // custom internal errors
		return ErrUnsupportedNumberOfTopics
	}

	//nolint: exhaustruct // optional security config
	kCfg := models.KafkaConfig{
		Brokers:       spec.Source.Brokers,
		SASLUser:      spec.Source.Security.SASLUsername,
		SASLPassword:  spec.Source.Security.SASLPassword,
		SASLMechanism: spec.Source.Security.SASLMechanism,
		IAMEnable:     spec.Source.Security.IAMEnable,
		IAMRegion:     spec.Source.Security.IAMRegion,
	}
	if spec.Source.Security.SASLProtocol == "SASL_SSL" {
		kCfg.SASLTLSEnable = true
	}

	bridges := make([]models.BridgeSpec, len(spec.Source.Topics))
	streamSchemas := make(map[string]models.StreamSchema, len(spec.Source.Topics))

	for i, t := range spec.Source.Topics {
		stream := fmt.Sprintf("stream-%s-%s", t.Topic, uuid.New())
		subject := stream + ".input"

		//nolint: exhaustruct // add dedup only after enabled check
		bs := models.BridgeSpec{
			Topic:                      t.Topic,
			Stream:                     stream,
			Subject:                    subject,
			ConsumerGroupID:            fmt.Sprintf("%s-%s", "cg", stream),
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
		}

		if t.Deduplication.Enabled {
			bs.DedupKey = t.Deduplication.ID
			bs.DedupKeyType = t.Deduplication.Type
			bs.DedupWindow = t.Deduplication.Window.Duration()
		}

		bridges[i] = bs

		var streamSchema models.StreamSchema
		for _, i := range t.Schema.Fields {
			streamSchema.Fields = append(streamSchema.Fields, struct {
				FieldName string
				FieldType string
			}{
				FieldName: i.Name,
				FieldType: i.DataType,
			})
		}

		if spec.Join.Enabled {
			streamSchema.JoinKey = spec.Join.ID
		}

		streamSchemas[stream] = streamSchema
	}

	err := p.BridgeRunner.SetupBridges(&kCfg, bridges)
	if err != nil {
		return fmt.Errorf("setup bridges: %w", err)
	}

	// updated according to new schema mapper config: https://glassflow.slack.com/archives/C06KBDQ0AR4/p1744017047603439
	mapper := models.SchemaMapper{
		Streams:     streamSchemas,
		SinkMapping: []models.SchemaMapperMapping{},
	}

	for _, m := range spec.Sink.Mapping {
		mapper.SinkMapping = append(mapper.SinkMapping, models.SchemaMapperMapping{
			ColumnName: m.ColumnName,
			ColumnType: m.ColumnType,
			StreamName: m.SourceName,
			FieldName:  m.FieldName,
		})
	}
	//nolint: forbidigo // just for dubug purposes
	fmt.Printf("%#v\n", mapper)

	// from here should sink + join take on

	return nil
}

func (p *PipelineManager) ShutdownPipeline() error {
	p.BridgeRunner.Shutdown(ShutdownTimeout)

	// here we must shutdown the sink and join operations

	return nil
}
