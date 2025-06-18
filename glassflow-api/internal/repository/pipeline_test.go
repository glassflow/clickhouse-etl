package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/core/client"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/models"
	"github.com/glassflow/clickhouse-etl-internal/glassflow-api/internal/service"
)

func setupTest(t *testing.T) *Storage {
	t.Helper()

	nc, err := client.NewNATSWrapper("http://localhost:4222", 0)
	if err != nil {
		t.Fatal("couldn't connect to NATS: ", err)
	}

	db, err := New(t.Context(), "pipelines_test", nc.JetStream())
	if err != nil {
		t.Fatal("couldn't create test KV store: ", err)
	}

	t.Cleanup(func() {
		//nolint: usetesting // t.Context() is done before cleanup is called
		err := nc.JetStream().DeleteKeyValue(context.Background(), "pipelines_test")
		if err != nil {
			t.Fatal(err)
		}
	})

	return db
}

func TestInsertPipelineSuccess(t *testing.T) {
	source, err := models.NewKafkaSourceComponent(models.KafkaSourceArgs{
		Servers:                    []string{"http://localhost:9092"},
		SkipAuth:                   true,
		SASLUser:                   "",
		SASLPassword:               "",
		SASLMechanism:              "",
		Protocol:                   "PLAINTEXT",
		RootCert:                   "",
		TopicName:                  "test",
		ConsumerGroupInitialOffset: "earliest",
		DedupEnabled:               false,
		DedupKey:                   "",
		DedupType:                  "",
		DedupWindow:                0,
		SchemaKind:                 "json",
		SchemaMap: map[string]string{
			"event_id": "string",
		},
	})
	require.NoError(t, err)

	sink, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:         "host",
		Port:         "1024",
		DB:           "testDB",
		User:         "test",
		Password:     "test",
		Table:        "testTable",
		Secure:       false,
		MaxBatchSize: 100,
		MaxDelayTime: 0,
		ColMap: []models.ClickhouseColumnMappingArgs{{
			Source:     "source",
			Field:      "event_id",
			ColumnName: "id",
			ColumnType: "string",
		}},
	})
	require.NoError(t, err)

	outputsMap := map[models.Component][]models.Component{
		source: {sink},
	}

	pid, err := models.NewPipelineID("my-pipeline")
	require.NoError(t, err)

	p, err := models.NewPipeline(pid, outputsMap)
	require.NoError(t, err)

	expectedJSON := `
    {
      "components": [
        {
          "component_kind": "kafka-source",
          "config": {
            "brokers": [
              "http://localhost:9092"
            ],
            "sasl_user": "",
            "sasl_password": "",
            "sasl_mechanism": "",
            "sasl_protocol": "PLAINTEXT",
            "skip_auth": true,
            "ca_cert": "",
            "topic": {
              "name": "test",
              "schema": {
                "kind": "json",
                "fields": [
                  {
                    "name": "event_id",
                    "data_type": "string"
                  }
                ]
              },
              "dedup_config": {
                "enabled": false,
                "key": "",
                "data_type": "",
                "window": "0s"
              },
              "consumer_group_id": "test",
              "consumer_group_initial_offset": "earliest"
            }
          }
        },
        {
          "component_kind": "clickhouse-sink",
          "config": {
            "type": "clickhouse",
            "host": "host",
            "port": "1024",
            "database": "testDB",
            "username": "test",
            "password": "test",
            "table": "testTable",
            "secure": false,
            "table_mapping": [
              {
                "source_id": "source",
                "field_name": "event_id",
                "column_name": "id",
                "column_type": "string"
              }
            ],
            "max_batch_size": 100,
            "max_delay_time": "0s"
          }
        }
      ],
      "outputs_map": {
        "kafka-source-test": [
          "clickhouse-sink-testDB-testTable"
        ]
      }
    }
  `

	db := setupTest(t)
	err = db.InsertPipeline(t.Context(), *p)
	require.NoError(t, err)

	entry, err := db.kv.Get(t.Context(), "my-pipeline")
	require.NoError(t, err)
	require.NotNil(t, entry)

	t.Cleanup(func() {
		//nolint: usetesting // t.Context() is done before cleanup is called
		err := db.kv.Delete(context.Background(), "my-pipeline")
		if err != nil {
			t.Fatal(err)
		}
	})

	var pi map[string]any
	err = json.Unmarshal(entry.Value(), &pi)
	require.NoError(t, err)

	require.Equal(t, "my-pipeline", entry.Key())
	require.Equal(t, map[string]any{source.ID(): []any{sink.ID()}}, pi["outputs_map"])
	require.Len(t, pi["components"], 2)
	require.JSONEq(t, expectedJSON, string(entry.Value()))
}

func TestInsertPipelineDuplicateIDFail(t *testing.T) {
	source, err := models.NewKafkaSourceComponent(models.KafkaSourceArgs{
		Servers:                    []string{"http://localhost:9092"},
		SkipAuth:                   true,
		SASLUser:                   "",
		SASLPassword:               "",
		SASLMechanism:              "",
		Protocol:                   "PLAINTEXT",
		RootCert:                   "",
		TopicName:                  "test",
		ConsumerGroupInitialOffset: "earliest",
		DedupEnabled:               false,
		DedupKey:                   "",
		DedupType:                  "",
		DedupWindow:                0,
		SchemaKind:                 "json",
		SchemaMap: map[string]string{
			"event_id": "string",
		},
	})
	require.NoError(t, err)

	sink, err := models.NewClickhouseSinkComponent(models.ClickhouseSinkArgs{
		Host:         "host",
		Port:         "1024",
		DB:           "testDB",
		User:         "test",
		Password:     "test",
		Table:        "testTable",
		Secure:       false,
		MaxBatchSize: 100,
		MaxDelayTime: 0,
		ColMap: []models.ClickhouseColumnMappingArgs{{
			Source:     "source",
			Field:      "event_id",
			ColumnName: "id",
			ColumnType: "string",
		}},
	})
	require.NoError(t, err)

	outputsMap := map[models.Component][]models.Component{
		source: {sink},
	}

	pid, err := models.NewPipelineID("my-pipeline")
	require.NoError(t, err)

	p, err := models.NewPipeline(pid, outputsMap)
	require.NoError(t, err)

	db := setupTest(t)
	err = db.InsertPipeline(t.Context(), *p)
	require.NoError(t, err)

	t.Cleanup(func() {
		//nolint: usetesting // t.Context() is done before cleanup is called
		err := db.kv.Delete(context.Background(), "my-pipeline")
		if err != nil {
			t.Fatal(err)
		}
	})

	err = db.InsertPipeline(t.Context(), *p)
	require.EqualError(t, service.ErrIDExists, err.Error())
}

type unknownComponent struct {
	Outputs []models.Component
	Inputs  []models.Component
	id      string
}

func (s *unknownComponent) GetOutputs() []models.Component {
	return s.Outputs
}

func (s *unknownComponent) SetOutputs(o []models.Component) {
	s.Outputs = o
}

func (s *unknownComponent) GetInputs() []models.Component {
	return s.Inputs
}

func (s *unknownComponent) SetInputs(i []models.Component) {
	s.Inputs = i
}

func (s *unknownComponent) ID() string {
	return s.id
}

func (s *unknownComponent) Validate() error {
	return nil
}

func TestInsertPipelineUnknownComponentFail(t *testing.T) {
	source := &unknownComponent{id: "source"}
	sink := &unknownComponent{id: "sink"}

	outputsMap := map[models.Component][]models.Component{
		source: {sink},
	}

	pid, err := models.NewPipelineID("my-pipeline")
	require.NoError(t, err)

	p, err := models.NewPipeline(pid, outputsMap)
	require.NoError(t, err)

	db := setupTest(t)
	err = db.InsertPipeline(t.Context(), *p)
	require.EqualError(t, fmt.Errorf("unsupported component kind"), err.Error())
}

func TestGetPipelineSuccess(t *testing.T) {
	pipelineJSON := `
    {
      "components": [
        {
          "component_kind": "kafka-source",
          "config": {
            "brokers": [
              "http://localhost:9092"
            ],
            "sasl_user": "",
            "sasl_password": "",
            "sasl_mechanism": "",
            "sasl_protocol": "PLAINTEXT",
            "skip_auth": true,
            "ca_cert": "",
            "topic": {
              "name": "test",
              "schema": {
                "kind": "json",
                "fields": [
                  {
                    "name": "event_id",
                    "data_type": "string"
                  }
                ]
              },
              "dedup_config": {
                "enabled": false,
                "key": "",
                "data_type": "",
                "window": "0s"
              },
              "consumer_group_id": "test",
              "consumer_group_initial_offset": "earliest"
            }
          }
        },
        {
          "component_kind": "clickhouse-sink",
          "config": {
            "type": "clickhouse",
            "host": "host",
            "port": "1024",
            "database": "testDB",
            "username": "test",
            "password": "test",
            "table": "testTable",
            "secure": false,
            "table_mapping": [
              {
                "source_id": "source",
                "field_name": "event_id",
                "column_name": "id",
                "column_type": "string"
              }
            ],
            "max_batch_size": 100,
            "max_delay_time": "0s"
          }
        }
      ],
      "outputs_map": {
        "kafka-source-test": [
          "clickhouse-sink-testDB-testTable"
        ]
      }
    }
  `

	db := setupTest(t)

	pipelineID := "my-pipeline"

	_, err := db.kv.Create(t.Context(), "my-pipeline", []byte(pipelineJSON))
	require.NoError(t, err)

	t.Cleanup(func() {
		//nolint: usetesting // t.Context() is done before cleanup is called
		err := db.kv.Delete(context.Background(), pipelineID)
		if err != nil {
			t.Fatal(err)
		}
	})

	pid, err := models.NewPipelineID(pipelineID)
	require.NoError(t, err)

	p, err := db.GetPipeline(t.Context(), pid)
	require.NoError(t, err)
	require.NotNil(t, p)
	require.Equal(t, pipelineID, p.ID.String())
	require.Len(t, p.Components, 2)

	k, ok := p.Components[0].(*models.KafkaSourceComponent)
	require.True(t, ok)

	require.Equal(t, "test", k.Topic.Name)
	require.Equal(t, []string{"http://localhost:9092"}, k.Brokers)
	require.Equal(t, "PLAINTEXT", k.SASLProtocol)
	require.True(t, k.SkipAuth)
	require.False(t, k.Topic.Deduplicate.Enabled)
	require.Equal(t, "test", k.Topic.ConsumerGroupID)
	require.Equal(t, "earliest", k.Topic.ConsumerGroupInitialOffset)

	ch, ok := p.Components[1].(*models.ClickhouseSinkComponent)
	require.True(t, ok)

	require.Equal(t, "testDB", ch.Database)
	require.Equal(t, "testTable", ch.Table)
	require.Equal(t, "test", ch.Username)
	require.Equal(t, "test", ch.Password)
	require.Equal(t, "host", ch.Host)
	require.Equal(t, "1024", ch.Port)
	require.False(t, ch.Secure)
}

func TestGetPipelineForUnknownIDFail(t *testing.T) {
	db := setupTest(t)

	pipelineID := "non-existing"

	pid, err := models.NewPipelineID(pipelineID)
	require.NoError(t, err)

	p, err := db.GetPipeline(t.Context(), pid)
	require.Nil(t, p)
	require.EqualError(t, service.ErrPipelineNotExists, err.Error())
}
