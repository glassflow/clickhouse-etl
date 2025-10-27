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
	kafkaURI      string
	kafkaProducer *kafka.Producer
	adminClient   *kafka.AdminClient
}

func (kw *KafkaWriter) Cleanup() error {
	kw.kafkaProducer.Close()
	kw.adminClient.Close()

	return nil
}

func NewKafkaWriter(kafkaURI string) (*KafkaWriter, error) {
	config := &kafka.ConfigMap{
		"bootstrap.servers":       kafkaURI,
		"socket.keepalive.enable": true,
		"client.id":               "kafka-admin",
		"debug":                   "broker,admin",
		"broker.address.family":   "v4",
	}

	producer, err := kafka.NewProducer(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka producer: %w", err)
	}

	adminClient, err := kafka.NewAdminClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka admin client: %w", err)
	}

	return &KafkaWriter{
		kafkaProducer: producer,
		adminClient:   adminClient,
		kafkaURI:      kafkaURI,
	}, nil
}

func (kw *KafkaWriter) CreateTopic(ctx context.Context, topic string, partitions int) error {
	// Create topic specification
	topicSpec := kafka.TopicSpecification{ //nolint:exhaustruct // only necessary fields
		Topic:             topic,
		NumPartitions:     partitions,
		ReplicationFactor: 1,
	}

	// Create the topic
	results, err := kw.adminClient.CreateTopics(
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

	// Force metadata refresh by querying the topic from the producer
	// This ensures the producer knows about all partitions before we try to write to them
	metadata, err := kw.kafkaProducer.GetMetadata(&topic, false, int(time.Second))
	if err != nil {
		return fmt.Errorf("failed to get metadata for topic %s: %w", topic, err)
	}

	// Verify the topic has the expected number of partitions
	topicMetadata, ok := metadata.Topics[topic]
	if !ok {
		return fmt.Errorf("topic %s not found in metadata", topic)
	}
	if len(topicMetadata.Partitions) != partitions {
		return fmt.Errorf("topic %s has %d partitions, expected %d", topic, len(topicMetadata.Partitions), partitions)
	}

	return nil
}

func (kw *KafkaWriter) DeleteTopic(ctx context.Context, topic string) error {
	results, err := kw.adminClient.DeleteTopics(
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
		err := kw.kafkaProducer.Produce(&kafka.Message{ //nolint:exhaustruct // only necessary fields
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

	timeoutMs := 1000
	remaining := kw.kafkaProducer.Flush(timeoutMs)
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
