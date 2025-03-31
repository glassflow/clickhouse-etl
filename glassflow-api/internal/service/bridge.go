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

type ErrStartBridge struct {
	msg string
}

func (e ErrStartBridge) Error() string {
	return fmt.Sprintf("failed to start bridge: %s", e.msg)
}

type BridgeImpl struct {
	id string

	Kafka *models.KafkaConfig
	Topic *models.TopicConfig

	Nats models.NatsConfig

	log *slog.Logger

	cmd *exec.Cmd
}

type BridgeFactoryImpl struct {
	natsServer string
	kafkaCfg   *models.KafkaConfig
	log        *slog.Logger
}

func NewBridgeFactory(natsServer string, log *slog.Logger) *BridgeFactoryImpl {
	return &BridgeFactoryImpl{
		natsServer: natsServer,
		log:        log,
	}
}

func (f *BridgeFactoryImpl) CreateBridge(k *models.KafkaConfig, t *models.TopicConfig) Bridge {
	id := fmt.Sprintf("%s-%s", t.Name, uuid.New())
	cgID := fmt.Sprintf("%s-%s", "cg", id)

	stream := fmt.Sprintf("%s-%s", "stream", id)
	subject := fmt.Sprintf("%s-%s", "input", id)

	cmd := exec.Command("nats-kafka-bridge")

	//nolint: exhaustruct // cmd will be added later
	return &BridgeImpl{
		id: id,

		Kafka: k,

		Topic: &models.TopicConfig{
			Name:                       t.Name,
			DedupWindow:                t.DedupWindow,
			DedupKey:                   t.DedupKey,
			DedupKeyType:               t.DedupKeyType,
			ConsumerGroupID:            cgID,
			ConsumerGroupInitialOffset: t.ConsumerGroupInitialOffset,
		},

		Nats: models.NatsConfig{
			Server:  f.natsServer,
			Subject: subject,
			Stream:  stream,
		},

		log: f.log,
		cmd: cmd,
	}
}

func (b *BridgeImpl) ID() string {
	return b.id
}

func (b *BridgeImpl) Start() error {
	b.setupEnv()

	stderr, err := b.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("pipe stderr: %w", err)
	}

	err = b.cmd.Start()
	if err != nil {
		return ErrStartBridge{msg: err.Error()}
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
			case strings.Contains(log, "[DBG]"), strings.Contains(log, "[TRC]"):
				level = slog.LevelDebug
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

func (b *BridgeImpl) Stop(ctx context.Context) {
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

func (b *BridgeImpl) setupEnv() {
	env := make(map[string]string)

	env["BRIDGE_CONNECTOR_ID"] = b.id

	env["BRIDGE_NATS_SERVER"] = b.Nats.Server
	env["BRIDGE_NATS_STREAM"] = b.Nats.Stream
	env["BRIDGE_NATS_SUBJECT"] = b.Nats.Subject
	env["BRIDGE_NATS_STREAM_DEDUP_WINDOW"] = b.Topic.DedupWindow.String()
	env["BRIDGE_NATS_STREAM_DEDUP_KEY"] = b.Topic.DedupKey
	env["BRIDGE_NATS_STREAM_DEDUP_KEY_TYPE"] = b.Topic.DedupKeyType

	env["BRIDGE_KAFKA_BROKERS"] = strings.Join(b.Kafka.Brokers, ",")
	env["BRIDGE_KAFKA_TOPIC"] = b.Topic.Name
	env["BRIDGE_KAFKA_CONSUMER_GROUP_ID"] = b.Topic.ConsumerGroupID
	env["BRIDGE_KAFKA_CONSUMER_GROUP_INITIAL_OFFSET"] = b.Topic.ConsumerGroupInitialOffset
	env["BRIDGE_KAFKA_IAM_ENABLE"] = strconv.FormatBool(b.Kafka.IAMEnable)
	env["BRIDGE_KAFKA_IAM_REGION"] = b.Kafka.IAMRegion

	for k, v := range env {
		b.cmd.Env = append(b.cmd.Environ(), fmt.Sprintf("%s=%s", k, v))
	}
}
