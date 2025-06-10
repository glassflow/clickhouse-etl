package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

type join struct {
	Kind    string       `json:"type"`
	Enabled bool         `json:"enabled"`
	Sources []joinSource `json:"sources"`
}

type joinSource struct {
	SourceID    string `json:"source_id"`
	JoinKey     string `json:"join_key"`
	Window      string `json:"time_window"`
	Orientation string `json:"orientation"`
}

func newJoinFromModel(j models.JoinComponent) (json.RawMessage, error) {
	sources := []joinSource{}

	for _, s := range j.Sources {
		js := joinSource{
			SourceID:    s.Source,
			JoinKey:     s.JoinKey,
			Window:      s.Window.String(),
			Orientation: s.JoinOrder.String(),
		}
		sources = append(sources, js)
	}

	//nolint: wrapcheck // no more context needed
	return json.Marshal(join{
		Kind:    j.Kind,
		Enabled: true,
		Sources: sources,
	})
}

func (j join) ToComponent() (models.Component, error) {
	sources := make([]models.JoinSourceArgs, len(j.Sources))
	for i, s := range j.Sources {
		w, err := time.ParseDuration(s.Window)
		if err != nil {
			return nil, fmt.Errorf("parse join window: %w", err)
		}

		sources[i] = models.JoinSourceArgs{
			Source:    s.SourceID,
			JoinKey:   s.JoinKey,
			Window:    w,
			JoinOrder: s.Orientation,
		}
	}

	jc, err := models.NewJoinComponent(j.Kind, sources)
	if err != nil {
		return nil, fmt.Errorf("parse join component from db: %w", err)
	}

	return jc, nil
}
