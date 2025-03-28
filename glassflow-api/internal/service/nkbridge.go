package service

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type BridgeManager struct {
	bridges    map[string]*Bridge
	natsServer string
	log        *slog.Logger

	m sync.Mutex
}

func NewBridgeManager(natsServer string, log *slog.Logger) *BridgeManager {
	//nolint: exhaustruct // mutex is initialized by zero value
	return &BridgeManager{
		natsServer: natsServer,
		log:        log,
		bridges:    make(map[string]*Bridge),
	}
}

func (bmgr *BridgeManager) SetupBridges(
	kafkaCfg *models.KafkaConfig,
	topics []*models.TopicConfig,
) error {
	bridges := make([]*Bridge, len(topics))

	for i, t := range topics {
		bridge := NewBridge(bmgr.natsServer, t, kafkaCfg, bmgr.log)

		err := bridge.Start()
		if err != nil {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			// extra non nil check due to peralloc
			for _, b := range bridges {
				if b != nil {
					b.Stop(ctx)
				}
			}

			return fmt.Errorf("start bridge for %s: %w", t.Name, err)
		}

		bridges[i] = bridge
	}

	for _, b := range bridges {
		bmgr.set(b.ID, b)
	}

	return nil
}

func (bmgr *BridgeManager) Get(id string) *Bridge {
	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	return bmgr.bridges[id]
}

func (bmgr *BridgeManager) set(id string, b *Bridge) {
	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	bmgr.bridges[id] = b
}

func (bmgr *BridgeManager) Shutdown(timeout time.Duration) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	wg := sync.WaitGroup{}

	for _, b := range bmgr.bridges {
		wg.Add(1)
		go func() {
			b.Stop(ctx)
			wg.Done()
		}()
	}

	wg.Wait()
}

type Bridge struct {
	ID string

	Kafka models.KafkaConfig
	Topic models.TopicConfig

	Nats models.NatsConfig

	log *slog.Logger

	cmd *exec.Cmd
}

func NewBridge(
	natsServer string,
	topicCfg *models.TopicConfig,
	kafkaCfg *models.KafkaConfig,
	log *slog.Logger,
) *Bridge {
	id := fmt.Sprintf("%s-%s", topicCfg.Name, uuid.New())
	cgID := fmt.Sprintf("%s-%s", "cg", id)

	stream := fmt.Sprintf("%s-%s", "stream", id)
	subject := fmt.Sprintf("%s-%s", "input", id)

	//nolint: exhaustruct // cmd will be added later
	return &Bridge{
		ID: id,

		Kafka: *kafkaCfg,

		Topic: models.TopicConfig{
			Name:                       topicCfg.Name,
			DedupWindow:                topicCfg.DedupWindow,
			DedupKey:                   topicCfg.DedupKey,
			DedupKeyType:               topicCfg.DedupKeyType,
			ConsumerGroupID:            cgID,
			ConsumerGroupInitialOffset: topicCfg.ConsumerGroupInitialOffset,
		},

		Nats: models.NatsConfig{
			Server:  natsServer,
			Subject: subject,
			Stream:  stream,
		},

		log: log,
	}
}

func (b *Bridge) Start() error {
	b.cmd = exec.Command("nats-kafka-bridge")

	b.setupEnv()

	stderr, err := b.cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("pipe stderr: %w", err)
	}

	err = b.cmd.Start()
	if err != nil {
		return fmt.Errorf("run command: %w", err)
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

func (b *Bridge) Stop(ctx context.Context) {
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

func (b *Bridge) setupEnv() {
	env := make(map[string]string)

	env["BRIDGE_CONNECTOR_ID"] = b.ID

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
