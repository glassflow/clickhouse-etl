package testutils

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"github.com/twmb/franz-go/pkg/kadm"
	"github.com/twmb/franz-go/pkg/kerr"
	"github.com/twmb/franz-go/pkg/kgo"
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
	client   *kgo.Client
}

func NewKafkaWriter(kafkaURI string) *KafkaWriter {
	return &KafkaWriter{
		kafkaURI: kafkaURI,
		client:   nil,
	}
}

func (kw *KafkaWriter) getClient() (*kgo.Client, error) {
	if kw.client != nil {
		return kw.client, nil
	}

	client, err := kgo.NewClient(
		kgo.SeedBrokers(kw.kafkaURI),
		kgo.WithLogger(kgo.BasicLogger(os.Stderr, kgo.LogLevelError, nil)),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create kafka client: %w", err)
	}

	kw.client = client
	return client, nil
}

func (kw *KafkaWriter) Close() {
	if kw.client != nil {
		kw.client.Close()
	}
}

func (kw *KafkaWriter) Reset() {
	if kw.client != nil {
		kw.client.Close()
		kw.client = nil
	}
}

func (kw *KafkaWriter) CreateTopic(ctx context.Context, topic string, partitions int) error {
	client, err := kw.getClient()
	if err != nil {
		return err
	}

	admClient := kadm.NewClient(client)

	resp, err := admClient.CreateTopics(ctx, int32(partitions), int16(1), nil, topic)
	if err != nil {
		return fmt.Errorf("failed to create topic: %w", err)
	}

	// Check for errors in response
	for _, topicResp := range resp {
		if topicResp.Err != nil {
			// Ignore "topic already exists" error
			if errors.Is(topicResp.Err, kerr.TopicAlreadyExists) {
				continue
			}
			return fmt.Errorf("failed to create topic %s: %w", topicResp.Topic, topicResp.Err)
		}
	}

	return nil
}

func (kw *KafkaWriter) DeleteTopic(ctx context.Context, topic string) error {
	client, err := kw.getClient()
	if err != nil {
		return err
	}

	admClient := kadm.NewClient(client)

	resp, err := admClient.DeleteTopics(ctx, topic)
	if err != nil {
		return fmt.Errorf("failed to delete topic: %w", err)
	}

	// Check for errors in response
	for _, topicResp := range resp {
		if topicResp.Err != nil {
			// Ignore "unknown topic" error
			if errors.Is(topicResp.Err, kerr.UnknownTopicOrPartition) {
				continue
			}
			return fmt.Errorf("failed to delete topic %s: %w", topicResp.Topic, topicResp.Err)
		}
	}

	return nil
}

func (kw *KafkaWriter) WriteJSONEvents(topic string, events []KafkaEvent) error {
	client, err := kw.getClient()
	if err != nil {
		return err
	}

	records := make([]*kgo.Record, 0, len(events))

	for _, event := range events {
		record := &kgo.Record{
			Topic: topic,
			Key:   []byte(event.Key),
			Value: event.Value,
		}

		// Set partition if specified
		if event.Partition != "" {
			p, err := strconv.ParseInt(event.Partition, 10, 32)
			if err != nil {
				return fmt.Errorf("failed to parse partition %s: %w", event.Partition, err)
			}
			record.Partition = int32(p)
		}

		records = append(records, record)
	}

	// Synchronous produce - waits for all records to be acknowledged
	results := client.ProduceSync(context.Background(), records...)

	// Check for errors in any of the results
	for _, result := range results {
		if result.Err != nil {
			return fmt.Errorf("failed to produce message to partition %d: %w", result.Record.Partition, result.Err)
		}
	}

	return nil
}

func (kw *KafkaWriter) GetLag(ctx context.Context, topic string, cGroupName string) (int64, error) {
	client, err := kw.getClient()
	if err != nil {
		return 0, err
	}

	admClient := kadm.NewClient(client)

	lags, err := admClient.Lag(ctx, cGroupName)
	if err != nil {
		return 0, fmt.Errorf("failed to get lag for consumer group %s: %w", cGroupName, err)
	}

	groupLag, exists := lags[cGroupName]
	if !exists {
		return 0, fmt.Errorf("consumer group %s not found in lag response (groups: %v)",
			cGroupName, getGroupNames(lags))
	}

	if groupLag.FetchErr != nil {
		return 0, fmt.Errorf("error fetching lag for group %s: %w", cGroupName, groupLag.FetchErr)
	}

	lagByTopic := groupLag.Lag.TotalByTopic()

	topicLag, exists := lagByTopic[topic]
	if !exists {
		return 0, fmt.Errorf("topic %s not found in consumer group %s (topics: %v)",
			topic, cGroupName, getTopicNames(lagByTopic))
	}

	return topicLag.Lag, nil
}

// Helper to extract group names for debugging
func getGroupNames(lags kadm.DescribedGroupLags) []string {
	names := make([]string, 0, len(lags))
	for name := range lags {
		names = append(names, name)
	}
	return names
}

// Helper to extract topic names for debugging
func getTopicNames(lagByTopic kadm.GroupTopicsLag) []string {
	names := make([]string, 0, len(lagByTopic))
	for name := range lagByTopic {
		names = append(names, name)
	}
	return names
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
