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
                "mapper": {
                    "type": "jsonToClickhouse",
                    "streams": {
                        "test_topic": {
                            "fields": [
                                {
                                    "field_name": "id",
                                    "field_type": "string"
                                },
                                {
                                    "field_name": "name",
                                    "field_type": "string"
                                }
                            ]
                        }
                    },
                    "sink_mapping": [
                        {
                            "stream_name": "test_topic",
                            "field_name": "id",
                            "column_name": "id",
                            "column_type": "String"
                        },
                        {
                            "stream_name": "test_topic",
                            "field_name": "name",
                            "column_name": "name",
                            "column_type": "String"
                        }
                    ]
                },
                "ingestor": {
                    "enabled": false,
                    "type": "kafka",
                    "kafka_connection_params": {
                        "brokers": [],
                        "mechanism": "NO_AUTH",
                        "protocol": "SASL_PLAINTEXT",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-ee04c824",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-ee04c824-test_topic",
                            "output_stream_subject": "gf-ee04c824-test_topic.input"
                        }
                    ]
                },
                "join": {
                    "enabled": false
                },
                "sink": {
                    "enabled": false,
                    "type": "clickhouse",
                    "batch": {
                        "max_batch_size": 1000,
                        "max_delay_time": "10ms"
                    },
                    "clickhouse_connection_params": {
                        "database": "default",
                        "secure": false,
                        "table": "events_test"
                    },
                    "stream_id": "gf-ee04c824-test_topic",
                    "nats_consumer_name": "gf-nats-si-ee04c824"
                }
            }
            """
    Then I publish a message to NATS stream "gf-ee04c824-test_topic" with subject "gf-ee04c824-test_topic.input"
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
    Then NATS stream "gf-ee04c824-test_topic" with subject "gf-ee04c824-test_topic.input" should contain 1 events
    Then NATS stream "gf-ee04c824-DLQ" with subject "gf-ee04c824-DLQ.failed" should contain 0 events