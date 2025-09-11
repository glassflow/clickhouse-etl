package testutils

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/confluentinc/confluent-kafka-go/kafka"
)

func NewTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		AddSource:   true,
		Level:       slog.LevelDebug,
		ReplaceAttr: nil,
	}))
}

func CombineErrors(errs []error) error {
	if len(errs) > 0 {
		var errStr strings.Builder
		for i, err := range errs {
			if i > 0 {
				errStr.WriteString("; ")
			}
			errStr.WriteString(err.Error())
		}
		return fmt.Errorf("errors occurred: %s", errStr.String())
	}

	return nil
}

type KafkaEvent struct {
	Key       string
	Value     []byte
	Partition string
}

type KafkaWriter struct {
	kafkaURI string
}

func NewKafkaWriter(kafkaURI string) *KafkaWriter {
	return &KafkaWriter{
		kafkaURI: kafkaURI,
	}
}

func (kw *KafkaWriter) CreateTopic(ctx context.Context, topic string, partitions int) error {
	adminConfig := kafka.ConfigMap{
		"bootstrap.servers":       kw.kafkaURI,
		"socket.keepalive.enable": true,
		"client.id":               "kafka-admin",
		"debug":                   "broker,admin",
		"broker.address.family":   "v4",
	}

	adminClient, err := kafka.NewAdminClient(&adminConfig)
	if err != nil {
		return fmt.Errorf("failed to create admin client: %w", err)
	}
	defer adminClient.Close()

	// Create topic specification
	topicSpec := kafka.TopicSpecification{ //nolint:exhaustruct // only necessary fields
		Topic:             topic,
		NumPartitions:     partitions,
		ReplicationFactor: 1,
	}

	// Create the topic
	results, err := adminClient.CreateTopics(
		ctx,
		[]kafka.TopicSpecification{topicSpec},
		kafka.SetAdminOperationTimeout(time.Second*30),
	)
	if err != nil {
		return fmt.Errorf("failed to create topic: %w", err)
	}

	// Check if there was an error with this specific topic
	for _, result := range results {
		if result.Error.Code() != kafka.ErrNoError && result.Error.Code() != kafka.ErrTopicAlreadyExists {
			return fmt.Errorf("failed to create topic %s: %w", result.Topic, result.Error)
		}
	}

	return nil
}

func (kw *KafkaWriter) DeleteTopic(ctx context.Context, topic string) error {
	adminConfig := &kafka.ConfigMap{
		"bootstrap.servers":       kw.kafkaURI,
		"socket.keepalive.enable": true,
		"client.id":               "kafka-admin",
		"debug":                   "broker,admin",
		"broker.address.family":   "v4",
	}

	adminClient, err := kafka.NewAdminClient(adminConfig)
	if err != nil {
		return fmt.Errorf("failed to create admin client: %w", err)
	}
	defer adminClient.Close()

	// Delete the topic
	results, err := adminClient.DeleteTopics(
		ctx,
		[]string{topic},
		kafka.SetAdminOperationTimeout(time.Second*30),
	)
	if err != nil {
		return fmt.Errorf("failed to delete topic: %w", err)
	}

	// Check if there was an error with this specific topic
	for _, result := range results {
		if result.Error.Code() != kafka.ErrNoError && result.Error.Code() != kafka.ErrUnknownTopic {
			return fmt.Errorf("failed to delete topic %s: %w", result.Topic, result.Error)
		}
	}

	return nil
}

func (kw *KafkaWriter) WriteJSONEvents(topic string, events []KafkaEvent) error {
	config := &kafka.ConfigMap{
		"bootstrap.servers":       kw.kafkaURI,
		"socket.keepalive.enable": true,
		"client.id":               "kafka-admin",
		"debug":                   "broker,admin",
		"broker.address.family":   "v4",
	}

	producer, err := kafka.NewProducer(config)
	if err != nil {
		return fmt.Errorf("failed to create producer: %w", err)
	}
	defer producer.Close()

	deliveryChan := make(chan kafka.Event, len(events)) // Buffered channel to prevent blocking

	for _, event := range events {
		partition := kafka.PartitionAny
		if event.Partition != "" {
			p, err := strconv.ParseInt(event.Partition, 10, 32)
			partition = int32(p)
			if err != nil {
				return fmt.Errorf("failed to set partition %s", event.Partition)
			}
		}
		err := producer.Produce(&kafka.Message{ //nolint:exhaustruct // only necessary fields
			TopicPartition: kafka.TopicPartition{ //nolint:exhaustruct // only necessary fields
				Topic:     &topic,
				Partition: partition,
			},
			Key:   []byte(event.Key),
			Value: event.Value,
		}, deliveryChan)

		if err != nil {
			return fmt.Errorf("failed to produce message: %w", err)
		}
	}

	for range events {
		e := <-deliveryChan
		m, ok := e.(*kafka.Message)
		if !ok {
			return fmt.Errorf("failed to cast event")
		}
		if m.TopicPartition.Error != nil {
			return fmt.Errorf("delivery failed: %w", m.TopicPartition.Error)
		}
	}

	remaining := producer.Flush(5000) // 5 second timeout
	if remaining > 0 {
		return fmt.Errorf("%d messages remain unflushed", remaining)
	}

	// Close delivery channel only after all operations are complete
	close(deliveryChan)

	return nil
}

func CheckTags(tagExpression string, scenarioTags string) bool {
	if tagExpression == "" {
		return true
	}

	tagMap := make(map[string]bool)
	for tag := range strings.SplitSeq(scenarioTags, ",") {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		tagMap[tag] = true
	}

	orParts := strings.SplitSeq(tagExpression, ",")

	for orPart := range orParts {
		andParts := strings.SplitSeq(orPart, "&&")

		allAndPartsMatch := true
		for andPart := range andParts {
			andPart = strings.TrimSpace(andPart)

			if strings.HasPrefix(andPart, "~") {
				tag := strings.TrimPrefix(andPart, "~")
				if tagMap[tag] {
					allAndPartsMatch = false
					break
				}
			} else {
				if !tagMap[andPart] {
					allAndPartsMatch = false
					break
				}
			}
		}

		if allAndPartsMatch {
			return true
		}
	}

	return false
}
