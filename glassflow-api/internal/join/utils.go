package join

import (
	"encoding/json"
	"fmt"

	"github.com/nats-io/nats.go"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// prepareData extracts fields from data according to join rules and maps them to output names.
// sourceID identifies which source's rules to use from the JoinAuxConfig.
// Returns a map with output field names as keys and extracted values.
func prepareData(sourceID string, data []byte, config *models.JoinAuxConfig) (map[string]any, error) {
	rules, ok := config.SourceJoinRules[sourceID]
	if !ok {
		return nil, fmt.Errorf("no join rules found for source %s", sourceID)
	}

	// Unmarshal once
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return nil, fmt.Errorf("failed to unmarshal data: %w", err)
	}

	result := make(map[string]any, len(rules))

	// O(1) lookups
	for sourceName, outputName := range rules {
		value, ok := parsed[sourceName]
		if !ok {
			return nil, fmt.Errorf("field %s not found in data for source %s", sourceName, sourceID)
		}
		result[outputName] = value
	}

	return result, nil
}

// joinData merges two prepared data maps into a single JSON byte slice.
// Fields from both maps are combined; if there are duplicate keys, right overwrites left.
func joinData(leftData, rightData map[string]any) ([]byte, error) {
	result := make(map[string]any, len(leftData)+len(rightData))

	for k, v := range leftData {
		result[k] = v
	}
	for k, v := range rightData {
		result[k] = v
	}

	joined, err := json.Marshal(result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal joined data: %w", err)
	}

	return joined, nil
}

// buildJoinedMessage prepares and joins left and right data according to the config,
// then creates a nats.Msg with the output schema version ID in the header.
func buildJoinedMessage(
	subject string,
	leftSourceID string,
	leftData []byte,
	rightSourceID string,
	rightData []byte,
	config *models.JoinAuxConfig,
) (*nats.Msg, error) {
	leftPart, err := prepareData(leftSourceID, leftData, config)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare left data: %w", err)
	}

	rightPart, err := prepareData(rightSourceID, rightData, config)
	if err != nil {
		return nil, fmt.Errorf("failed to prepare right data: %w", err)
	}

	joinedData, err := joinData(leftPart, rightPart)
	if err != nil {
		return nil, fmt.Errorf("failed to join data: %w", err)
	}

	msg := nats.NewMsg(subject)
	msg.Data = joinedData
	msg.Header.Set(internal.SchemaVersionIDHeader, config.OutputSchemaVersionID)

	return msg, nil
}
