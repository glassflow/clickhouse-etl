package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nats-io/nats.go/jetstream"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

type pipelineComponentKind string

const (
	kafkaSourceKind    pipelineComponentKind = "kafka-source"
	clickhouseSinkKind pipelineComponentKind = "clickhouse-sink"
	joinKind           pipelineComponentKind = "joiner"
)

type pipeline struct {
	Components []pipelineComponent `json:"components"`
	OutputsMap map[string][]string `json:"output_maps"`
}

type pipelineComponent struct {
	ComponentKind pipelineComponentKind `json:"component_kind"`
	Config        json.RawMessage       `json:"config"`
}

type dbModel interface {
	ToComponent() (models.Component, error)
}

func unmarshalComponent[D dbModel](data json.RawMessage) (models.Component, error) {
	var d D

	err := json.Unmarshal(data, &d)
	if err != nil {
		return nil, fmt.Errorf("unmarshal entry: %w", err)
	}

	return d.ToComponent()
}

func (s *Storage) InsertPipeline(ctx context.Context, p models.Pipeline) error {
	components := []pipelineComponent{}
	outputsMap := make(map[string][]string)

	for _, c := range p.Components {
		for _, o := range c.GetOutputs() {
			outputsMap[c.ID()] = append(outputsMap[c.ID()], o.ID())
		}

		switch c := c.(type) {
		case *models.KafkaSourceComponent:
			ks, err := newKafkaSourceFromModel(*c)
			if err != nil {
				return err
			}
			components = append(components, pipelineComponent{
				ComponentKind: kafkaSourceKind,
				Config:        ks,
			})
		case *models.JoinComponent:
			j, err := newJoinFromModel(*c)
			if err != nil {
				return err
			}
			components = append(components, pipelineComponent{
				ComponentKind: joinKind,
				Config:        j,
			})
		case *models.ClickhouseSinkComponent:
			cs, err := newClickhouseSinkFromModel(*c)
			if err != nil {
				return err
			}
			components = append(components, pipelineComponent{
				ComponentKind: clickhouseSinkKind,
				Config:        cs,
			})
		default:
			return fmt.Errorf("unsupported component kind")
		}
	}

	pc, err := json.Marshal(pipeline{Components: components, OutputsMap: outputsMap})
	if err != nil {
		return fmt.Errorf("marshal kv pipeline: %w", err)
	}

	_, err = s.kv.Create(ctx, p.PipelineID, pc)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyExists) {
			return service.ErrIDExists
		}
		return fmt.Errorf("add pipeline in kv: %w", err)
	}

	return nil
}

func (s *Storage) GetPipeline(ctx context.Context, id string) (*models.Pipeline, error) {
	entry, err := s.kv.Get(ctx, id)
	if err != nil {
		if errors.Is(err, jetstream.ErrKeyNotFound) {
			return nil, service.ErrPipelineNotExists
		}
		return nil, fmt.Errorf("get pipeline from kv: %w", err)
	}

	var p pipeline
	err = json.Unmarshal(entry.Value(), &p)
	if err != nil {
		return nil, fmt.Errorf("unmarshal loaded entry: %w", err)
	}

	modelComponents := []models.Component{}
	modelCompsIDMap := make(map[string]models.Component)
	var unmarshaller func(json.RawMessage) (models.Component, error)
	for _, co := range p.Components {
		switch co.ComponentKind {
		case kafkaSourceKind:
			unmarshaller = unmarshalComponent[kafkaSourceComponent]
		case joinKind:
			unmarshaller = unmarshalComponent[join]
		case clickhouseSinkKind:
			unmarshaller = unmarshalComponent[clickhouseSink]
		default:
			return nil, fmt.Errorf("unsupported pipeline component in kv: %s", co.ComponentKind)
		}

		c, err := unmarshaller(co.Config)
		if err != nil {
			return nil, fmt.Errorf("load %s component: %w", co.ComponentKind, err)
		}
		modelCompsIDMap[c.ID()] = c
		modelComponents = append(modelComponents, c)
	}

	modelOutputs := make(map[models.Component][]models.Component)

	for _, c := range modelComponents {
		var outputComponents []models.Component
		outputIDs := p.OutputsMap[c.ID()]
		for _, oID := range outputIDs {
			outputComponents = append(outputComponents, modelCompsIDMap[oID])
		}
		modelOutputs[c] = outputComponents
	}

	return models.NewPipeline(entry.Key(), modelOutputs)
}
