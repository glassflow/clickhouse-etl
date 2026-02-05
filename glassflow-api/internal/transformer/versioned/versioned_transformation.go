package versioned

import (
	"context"
	"errors"
	"fmt"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"

	jsonTransformer "github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/transformer/json"
)

type storage interface {
	GetStatelessTransformationConfig(
		ctx context.Context,
		pipelineID, sourceID, sourceSchemaVersion string,
	) (*models.TransformationConfig, error)
}

type componentSignal interface {
	SendSignal(ctx context.Context, msg models.ComponentSignal) error
}

type statelessTransformer interface {
	Transform(ctx context.Context, inputMessage models.Message) (models.Message, error)
}

type VersionedTransformer struct {
	config      *models.TransformationConfig
	transformer statelessTransformer
}

type SourceSchemaVersionID string

type Transformer struct {
	storage                  storage
	componentSignal          componentSignal
	pipelineID               string
	sourceID                 string
	versionedTransformations map[SourceSchemaVersionID]VersionedTransformer
}

func New(
	storage storage,
	componentSignal componentSignal,
	pipelineID string,
	sourceID string,
) *Transformer {
	return &Transformer{
		storage:                  storage,
		componentSignal:          componentSignal,
		pipelineID:               pipelineID,
		sourceID:                 sourceID,
		versionedTransformations: make(map[SourceSchemaVersionID]VersionedTransformer),
	}
}

func (t *Transformer) Transform(ctx context.Context, inputMessage models.Message) (models.Message, error) {
	sourceSchemaVersionID := SourceSchemaVersionID(inputMessage.GetHeader(internal.SchemaVersionIDHeader))

	if sourceSchemaVersionID == "" {
		return inputMessage, models.ErrSchemaIDIsMissingInHeader
	}

	var err error

	versionedTransformer, ok := t.versionedTransformations[sourceSchemaVersionID]
	if ok {
		return t.transformMessage(ctx, inputMessage, versionedTransformer)
	}

	versionedTransformer, err = t.getNewVersionTransformer(ctx, sourceSchemaVersionID)
	if err != nil {
		if errors.Is(err, models.ErrRecordNotFound) || errors.Is(err, models.ErrCompileTransformation) {
			signalErr := t.componentSignal.SendSignal(ctx, models.ComponentSignal{
				Component:  internal.RoleDeduplicator,
				PipelineID: t.pipelineID,
				Reason:     err.Error(),
				Text:       fmt.Sprintf("failed to get new transformation version: %s", sourceSchemaVersionID),
			})
			if signalErr != nil {
				return models.Message{}, fmt.Errorf("send signal: %w", signalErr)
			}
			return models.Message{}, models.ErrSignalSent
		}

		return models.Message{}, fmt.Errorf("get new transformer version: %w", err)
	}
	t.versionedTransformations[sourceSchemaVersionID] = versionedTransformer

	return t.transformMessage(ctx, inputMessage, versionedTransformer)
}

func (t *Transformer) transformMessage(ctx context.Context, inputMessage models.Message, versionedTransformer VersionedTransformer) (models.Message, error) {
	transformedMessage, err := versionedTransformer.transformer.Transform(ctx, inputMessage)
	if err != nil {
		return models.Message{}, fmt.Errorf("versioned transform: %w", err)
	}

	transformedMessage.DeleteHeader(internal.SchemaVersionIDHeader)
	transformedMessage.AddHeader(internal.SchemaVersionIDHeader, versionedTransformer.config.OutputSchemaVersionID)

	return transformedMessage, nil
}

func (t *Transformer) getNewVersionTransformer(
	ctx context.Context,
	sourceSchemaVersionID SourceSchemaVersionID,
) (VersionedTransformer, error) {
	transformationConfig, err := t.storage.GetStatelessTransformationConfig(
		ctx,
		t.pipelineID,
		t.sourceID,
		string(sourceSchemaVersionID),
	)
	if err != nil {
		return VersionedTransformer{}, err
	}

	transformer, err := jsonTransformer.NewTransformer(transformationConfig.Config)
	if err != nil {
		return VersionedTransformer{}, err
	}

	return VersionedTransformer{
		config:      transformationConfig,
		transformer: transformer,
	}, nil
}
