package service

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strconv"
	"strings"
	"syscall"

	"github.com/google/uuid"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type StartBridgeError struct {
	msg string
}

func (e StartBridgeError) Error() string {
	return "failed to start bridge: " + e.msg
}

type bridgeImpl struct {
	id string

	Kafka *models.KafkaConfig
	Topic *models.TopicConfig

	Nats models.NatsConfig

	log *slog.Logger

	cmd *exec.Cmd
}

type FactoryImpl struct {
	natsServer string
	log        *slog.Logger
}

func NewFactory(natsServer string, log *slog.Logger) *FactoryImpl {
	return &FactoryImpl{
		natsServer: natsServer,
		log:        log,
	}
}

func (f *FactoryImpl) CreateBridge(k *models.KafkaConfig, b *models.BridgeSpec) Bridge {
	id := fmt.Sprintf("%s-%s", b.Topic, uuid.New())

	cmd := exec.Command("nats-kafka-bridge")

	return &bridgeImpl{
		id: id,

		Kafka: k,

		Topic: &models.TopicConfig{
			Name:                       b.Topic,
			DedupEnabled:               b.DedupEnabled,
			DedupWindow:                b.DedupWindow,
			DedupKey:                   b.DedupKey,
			DedupKeyType:               b.DedupKeyType,
			ConsumerGroupID:            b.ConsumerGroupID,
			ConsumerGroupInitialOffset: b.ConsumerGroupInitialOffset,
		},

		Nats: models.NatsConfig{
			Server:  f.natsServer,
			Subject: b.Topic + ".input",
			Stream:  b.Topic,
		},

		log: f.log,
		cmd: cmd,
	}
}

func (b *bridgeImpl) ID() string {
	return b.id
}

func (b *bridgeImpl) Start() error {
	b.setupEnv()

	stderr, err := b.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("pipe stderr: %w", err)
	}

	err = b.cmd.Start()
	if err != nil {
		return StartBridgeError{msg: err.Error()}
	}

	go func() {
		defer stderr.Close()

		r := bufio.NewReader(stderr)
		for {
			var level slog.Level

			l, _, err := r.ReadLine()
			if err != nil {
				return
			}

			log := string(l)

			switch {
			case strings.Contains(log, "[INF]"):
				level = slog.LevelInfo
			case strings.Contains(log, "[WRN]"):
				level = slog.LevelWarn
			case strings.Contains(log, "[ERR]"), strings.Contains(log, "[FTL]"):
				level = slog.LevelError
			default:
				level = slog.LevelDebug
			}

			b.log.Log(context.Background(), level, fmt.Sprintf("[Kafka:%s to JS] %s", b.Topic.Name, log))
		}
	}()

	go func() {
		err := b.cmd.Wait()
		if err != nil {
			//nolint: errorlint // https://github.com/golang/go/issues/35874
			switch err.(type) {
			case *exec.ExitError:
				b.log.Error("bridge stopped with error", slog.Any("error", err))
			default:
				return
			}
		}
	}()

	return nil
}

func (b *bridgeImpl) Stop(ctx context.Context) {
	err := b.cmd.Process.Signal(syscall.SIGTERM)
	if err != nil {
		b.log.Warn("")
	}
	ch := make(chan any, 1)

	go func() {
		ch <- b.cmd.Wait()
	}()

	select {
	case <-ch:
	case <-ctx.Done():
		//nolint: errcheck // cannot really do anything with errcheck
		b.cmd.Process.Kill()
	}
}

func (b *bridgeImpl) setupEnv() {
	env := make(map[string]string)

	env["BRIDGE_CONNECTOR_ID"] = b.id

	env["BRIDGE_NATS_SERVER"] = b.Nats.Server
	env["BRIDGE_NATS_STREAM"] = b.Nats.Stream
	env["BRIDGE_NATS_SUBJECT"] = b.Nats.Subject
	env["BRIDGE_NATS_STREAM_DEDUP_ENABLED"] = strconv.FormatBool(b.Topic.DedupEnabled)
	env["BRIDGE_NATS_STREAM_DEDUP_WINDOW"] = b.Topic.DedupWindow.String()
	env["BRIDGE_NATS_STREAM_DEDUP_KEY"] = b.Topic.DedupKey
	env["BRIDGE_NATS_STREAM_DEDUP_KEY_TYPE"] = b.Topic.DedupKeyType

	env["BRIDGE_KAFKA_BROKERS"] = strings.Join(b.Kafka.Brokers, ",")
	env["BRIDGE_KAFKA_TOPIC"] = b.Topic.Name
	env["BRIDGE_KAFKA_CONSUMER_GROUP_ID"] = b.Topic.ConsumerGroupID
	env["BRIDGE_KAFKA_CONSUMER_GROUP_INITIAL_OFFSET"] = b.Topic.ConsumerGroupInitialOffset

	env["BRIDGE_KAFKA_SASL_USER"] = b.Kafka.SASLUser
	env["BRIDGE_KAFKA_SASL_PASSWORD"] = b.Kafka.SASLPassword
	env["BRIDGE_KAFKA_SASL_MECHANISM"] = b.Kafka.SASLMechanism
	env["BRIDGE_KAFKA_SASL_TLS_ENABLE"] = strconv.FormatBool(b.Kafka.SASLTLSEnable)

	env["BRIDGE_KAFKA_TLS_ROOT"] = b.Kafka.TLSRoot

	for k, v := range env {
		b.cmd.Env = append(b.cmd.Environ(), fmt.Sprintf("%s=%s", k, v))
	}
}
