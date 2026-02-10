@pipeline
Feature: Working with DLQ

    Scenario: Purge DLQ
        And the ClickHouse table "events_test" on database "default" already exists with schema
            | column_name | data_type |
            | id          | String    |
            | name        | String    |
        Given a glassflow pipeline with next configuration:
            """json
            {
                "pipeline_id": "kafka-to-ch-pipeline-123",
                "name": "kafka-to-ch-pipeline-123",
                "ingestor": {
                    "type": "kafka",
                    "kafka_topics": [
                        {
                            "id": "test_topic",
                            "name": "test_topic",
                            "output_stream_id": "gf-test_topic",
                            "output_stream_subject": "gf-test_topic.*",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-ch-pipeline-123",
                            "replicas": 1,
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            }
                        }
                    ]
                },
                "sink": {
                    "type": "clickhouse",
                    "source_id": "test_topic",
                    "stream_id": "gf-test_topic",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "10ms"
                    },
                    "config": [
                        {
                            "source_field": "id",
                            "source_type": "string",
                            "destination_field": "id",
                            "destination_type": "String"
                        },
                        {
                            "source_field": "name",
                            "source_type": "string",
                            "destination_field": "name",
                            "destination_type": "String"
                        }
                    ]
                },
                "schema_versions": {
                    "test_topic": {
                        "source_id": "test_topic",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "id",
                                "type": "string"
                            },
                            {
                                "name": "name",
                                "type": "string"
                            }
                        ]
                    }
                }
            }
            """
        Then I publish a message to NATS stream "gf-test_topic" with subject "gf-test_topic.input"
            """json
            {
                "id": "123",
                "name": "world"
            }
            """
        Then I publish a message to NATS stream "gf-ee04c824-DLQ" with subject "gf-ee04c824-DLQ.failed"
            """json
            {
                "id": "123",
                "name": "world"
            }
            """
        Then I send a POST request to "/api/v1/pipeline/kafka-to-ch-pipeline-123/dlq/purge"
        Then NATS stream "gf-test_topic" with subject "gf-test_topic.input" should contain 1 events
        Then NATS stream "gf-ee04c824-DLQ" with subject "gf-ee04c824-DLQ.failed" should contain 0 events