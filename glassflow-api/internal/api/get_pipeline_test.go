package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api/mocks"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func TestGetPipeline_WithoutSchemaQuery_UsesDefaultLookup(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	h := &handler{log: slog.Default(), pipelineService: mockPipelineService}

	input := &GetPipelineInput{ID: "pipeline-1"}
	mockPipelineService.EXPECT().
		GetPipeline(gomock.Any(), "pipeline-1", gomock.Nil()).
		Return(models.PipelineConfig{ID: "pipeline-1"}, nil)

	resp, err := h.getPipeline(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "pipeline-1", resp.Body.PipelineID)
}

func TestGetPipeline_WithSchemaQuery_UsesVersionedLookup(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	h := &handler{log: slog.Default(), pipelineService: mockPipelineService}

	input := &GetPipelineInput{ID: "pipeline-1", Schema: []string{"topicA:1001", "topicB:2001"}}
	mockPipelineService.EXPECT().
		GetPipeline(gomock.Any(), "pipeline-1", map[string]string{"topicA": "1001", "topicB": "2001"}).
		Return(models.PipelineConfig{ID: "pipeline-1"}, nil)

	resp, err := h.getPipeline(context.Background(), input)
	require.NoError(t, err)
	require.NotNil(t, resp)
	assert.Equal(t, "pipeline-1", resp.Body.PipelineID)
}

func TestGetPipeline_WithInvalidSchemaQuery_ReturnsBadRequest(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	h := &handler{log: slog.Default(), pipelineService: mockPipelineService}

	input := &GetPipelineInput{ID: "pipeline-1", Schema: []string{"broken"}}

	resp, err := h.getPipeline(context.Background(), input)
	require.Error(t, err)
	require.Nil(t, resp)

	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusBadRequest, errDetail.Status)
	assert.Equal(t, "bad_request", errDetail.Code)
}

func TestGetPipeline_InvalidSchemaSelection_ReturnsBadRequest(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	mockPipelineService := mocks.NewMockPipelineService(ctrl)
	h := &handler{log: slog.Default(), pipelineService: mockPipelineService}

	input := &GetPipelineInput{ID: "pipeline-1", Schema: []string{"topicA:1001"}}
	mockPipelineService.EXPECT().
		GetPipeline(gomock.Any(), "pipeline-1", map[string]string{"topicA": "1001"}).
		Return(models.PipelineConfig{}, fmt.Errorf("invalid: %w", service.ErrInvalidSchemaSelection))

	resp, err := h.getPipeline(context.Background(), input)
	require.Error(t, err)
	require.Nil(t, resp)

	var errDetail *ErrorDetail
	require.ErrorAs(t, err, &errDetail)
	assert.Equal(t, http.StatusBadRequest, errDetail.Status)
}
