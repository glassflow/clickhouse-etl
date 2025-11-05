package api

import (
	"context"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/api/mocks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func TestPlatformHandler(t *testing.T) {
	tests := []struct {
		name             string
		orchestratorType string
		expectedResponse PlatformResponse
	}{
		{
			name:             "local orchestrator",
			orchestratorType: "local",
			expectedResponse: PlatformResponse{
				Body: PlatformInfo{
					Orchestrator: "local",
				},
			},
		},
		{
			name:             "k8s orchestrator",
			orchestratorType: "k8s",
			expectedResponse: PlatformResponse{
				Body: PlatformInfo{
					Orchestrator: "k8s",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			mockPipelineService := mocks.NewMockPipelineService(ctrl)
			mockPipelineService.EXPECT().GetOrchestratorType().Return(tt.orchestratorType)

			h := &handler{
				pipelineService: mockPipelineService,
				dlqSvc:          nil,
			}

			response, err := h.platform(context.Background(), &struct{}{})
			require.NoError(t, err)
			require.NotNil(t, response)

			assert.Equal(t, tt.expectedResponse.Body.Orchestrator, response.Body.Orchestrator)
			assert.Equal(t, tt.expectedResponse.Body.APIVersion, response.Body.APIVersion)
		})
	}
}

func TestPlatformHandlerWithNilPipelineService(t *testing.T) {
	h := &handler{
		pipelineService: nil,
		dlqSvc:          nil,
	}

	response, err := h.platform(context.Background(), &struct{}{})
	require.NoError(t, err)
	require.NotNil(t, response)

	assert.Equal(t, "unknown", response.Body.Orchestrator)
	assert.Equal(t, "", response.Body.APIVersion)
}
