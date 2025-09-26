package kafka

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
)

// TestConfluentConsumerCreation tests that we can create a confluent consumer
func TestConfluentConsumerCreation(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))

	conn := models.KafkaConnectionParamsConfig{
		Brokers:  []string{"localhost:9092"},
		SkipAuth: true,
	}

	topic := models.KafkaTopicsConfig{
		Name:              "test-topic",
		ConsumerGroupName: "test-group",
	}

	consumer, err := NewConsumer(conn, topic, logger)
	if err != nil {
		t.Fatalf("Failed to create confluent consumer: %v", err)
	}

	if consumer == nil {
		t.Fatal("Consumer is nil")
	}

	// Clean up
	if err := consumer.Close(); err != nil {
		t.Errorf("Failed to close consumer: %v", err)
	}
}

// TestBatchProcessor tests the batch processor
func TestBatchProcessor(t *testing.T) {

	// Mock processor
	mockProcessor := &mockMessageProcessor{}

	// Create a test batch
	batch := MessageBatch{
		{
			Topic:     "test-topic",
			Partition: 0,
			Offset:    1,
			Key:       []byte("key1"),
			Value:     []byte("value1"),
		},
		{
			Topic:     "test-topic",
			Partition: 0,
			Offset:    2,
			Key:       []byte("key2"),
			Value:     []byte("value2"),
		},
	}

	ctx := context.Background()
	err := mockProcessor.ProccessBatch(ctx, batch)
	if err != nil {
		t.Fatalf("Failed to process batch: %v", err)
	}

	if mockProcessor.callCount != 2 {
		t.Errorf("Expected 2 calls to ProcessMessage, got %d", mockProcessor.callCount)
	}
}

// Mock message processor for testing
type mockMessageProcessor struct {
	callCount int
}

func (m *mockMessageProcessor) ProcessMessage(_ context.Context, _ Message) error {
	m.callCount++
	return nil
}

func (m *mockMessageProcessor) ProccessBatch(_ context.Context, batch MessageBatch) error {
	for range batch {
		m.callCount++
	}
	return nil
}
