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
	CreateBridge(*models.KafkaConfig, *models.TopicConfig) Bridge
}

type BridgeManager struct {
	factory BridgeFactory
	bridges map[string]Bridge

	m sync.Mutex
}

func NewBridgeManager(factory BridgeFactory) *BridgeManager {
	//nolint: exhaustruct // mutex is initialized by zero value
	return &BridgeManager{
		factory: factory,
		bridges: make(map[string]Bridge),
	}
}

func (bmgr *BridgeManager) SetupBridges(
	kafkaCfg *models.KafkaConfig,
	topics []*models.TopicConfig,
) error {
	bridges := make([]Bridge, len(topics))

	for i, t := range topics {
		bridge := bmgr.factory.CreateBridge(kafkaCfg, t)

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
		bmgr.set(b.ID(), b)
	}

	return nil
}

func (bmgr *BridgeManager) Get(id string) Bridge {
	bmgr.m.Lock()
	defer bmgr.m.Unlock()

	return bmgr.bridges[id]
}

func (bmgr *BridgeManager) set(id string, b Bridge) {
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
