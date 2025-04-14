package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Bridge interface {
	ID() string
	Start() error
	Stop(context.Context)
}

type BridgeFactory interface {
	CreateBridge(*models.KafkaConfig, *models.BridgeSpec) Bridge
}

type BridgeRunner struct {
	factory BridgeFactory
	bridges map[string]Bridge

	m sync.Mutex
}

func NewBridgeRunner(factory BridgeFactory) *BridgeRunner {
	//nolint: exhaustruct // mutex is initialized by zero value
	return &BridgeRunner{
		factory: factory,
		bridges: make(map[string]Bridge),
	}
}

func (bmgr *BridgeRunner) SetupBridges(
	kafkaCfg *models.KafkaConfig,
	streams []models.StreamConfig,
) error {
	specs := bmgr.createBridgeSpec(streams)

	bridges := make([]Bridge, len(specs))

	for i, s := range specs {
		bridge := bmgr.factory.CreateBridge(kafkaCfg, &s)

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

			return fmt.Errorf("start bridge for %s: %w", s.Topic, err)
		}

		bridges[i] = bridge
	}

	for _, b := range bridges {
		bmgr.set(b.ID(), b)
	}

	return nil
}

func (bmgr *BridgeRunner) createBridgeSpec(streams []models.StreamConfig) []models.BridgeSpec {
	bridges := make([]models.BridgeSpec, len(streams))
	// streamSchemas := make(map[string]models.StreamSchema, len(spec.Source.Topics))

	for i, s := range streams {
		//nolint: exhaustruct // add dedup only after enabled check
		bs := models.BridgeSpec{
			Topic:                      s.Source.Name,
			Stream:                     s.Name,
			Subject:                    s.Subject,
			ConsumerGroupID:            fmt.Sprintf("%s-%s", "cg", s.Name),
			ConsumerGroupInitialOffset: s.Source.ConsumerGroupInitialOffset,
		}

		bs.DedupEnabled = s.Deduplication.Enabled
		bs.DedupKey = s.Deduplication.ID
		bs.DedupKeyType = s.Deduplication.Type
		bs.DedupWindow = s.Deduplication.Window

		bridges[i] = bs
	}

	return bridges
}

func (bmgr *BridgeRunner) Get(id string) Bridge {
	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	return bmgr.bridges[id]
}

func (bmgr *BridgeRunner) set(id string, b Bridge) {
	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	bmgr.bridges[id] = b
}

func (bmgr *BridgeRunner) Shutdown(timeout time.Duration) {
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
