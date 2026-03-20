package router

import (
	"fmt"
	"math/rand/v2"

	"github.com/cespare/xxhash/v2"
	"github.com/tidwall/gjson"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type Router struct {
	config models.RoutingConfig
}

func New(config models.RoutingConfig) (*Router, error) {
	if err := config.Validate(); err != nil {
		return nil, err
	}
	return &Router{config: config}, nil
}

// since we don't have any support for protobuf now, router will only support
// json, but it might be tricky in future to figure out support for proto

func (r *Router) Config() models.RoutingConfig {
	return r.config
}

func (r *Router) Subject(msg []byte) string {
	var n int
	switch r.config.Type {
	case models.RoutingTypePodIndex:
		n = r.config.PodIndex.Index
	case models.RoutingTypeRandom:
		n = rand.IntN(r.config.SubjectCount)
	case models.RoutingTypeHash:
		n = int(subjectNum(msg, uint64(r.config.SubjectCount)))
	case models.RoutingTypeField:
		field := gjson.GetBytes(msg, r.config.Field.Name).Raw
		n = int(subjectNum([]byte(field), uint64(r.config.SubjectCount)))
	case models.RoutingTypeName:
		return r.config.OutputSubject
	}
	return fmt.Sprintf("%s.%d", r.config.OutputSubject, n)
}

func subjectNum(data []byte, subjectCount uint64) uint64 {
	return xxhash.Sum64(data) % subjectCount
}
