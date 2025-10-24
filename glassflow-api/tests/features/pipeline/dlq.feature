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
                "pipeline_id": "kafka-to-clickhouse-pipeline-dfadfbad-aeec-43a9-9870-b7d5ac993ae7",
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
                        "skip_auth": true,
                        "protocol": "SASL_PLAINTEXT",
                        "mechanism": "",
                        "username": "",
                        "password": "",
                        "root_ca": ""
                    },
                    "kafka_topics": [
                        {
                            "name": "test_topic",
                            "consumer_group_initial_offset": "earliest",
                            "consumer_group_name": "glassflow-consumer-group-kafka-to-clickhouse-pipeline-dfadfbad-aeec-43a9-9870-b7d5ac993ae7",
                            "deduplication": {
                                "enabled": true,
                                "id_field": "id",
                                "id_field_type": "string",
                                "time_window": "1h"
                            },
                            "output_stream_id": "gf-d7fac70f-test_topic",
                            "output_stream_subject": "gf-d7fac70f-test_topic.input"
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
                    "stream_id": "gf-d7fac70f-test_topic",
                    "nats_consumer_name": "gf-nats-si-d7fac70f"
                }
            }
            """
    Then I publish a message to NATS stream "gf-d7fac70f-test_topic" with subject "gf-d7fac70f-test_topic.input"
        """json
        {
          "id": "123",
          "name": "world"
        }
        """
    Then I publish a message to NATS stream "gf-d7fac70f-DLQ" with subject "gf-d7fac70f-DLQ.failed"
    """json
        {
          "id": "123",
          "name": "world"
        }
        """
    Then I send a POST request to "/api/v1/pipeline/kafka-to-clickhouse-pipeline-dfadfbad-aeec-43a9-9870-b7d5ac993ae7/dlq/purge"
    Then NATS stream "gf-d7fac70f-test_topic" with subject "gf-d7fac70f-test_topic.input" should contain 1 events
    Then NATS stream "gf-d7fac70f-DLQ" with subject "gf-d7fac70f-DLQ.failed" should contain 0 events