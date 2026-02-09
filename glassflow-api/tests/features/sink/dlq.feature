@sink
Feature: Clickhouse ETL sink dlq
        Given a running NATS instance
        And a running ClickHouse instance

    Background: Run setup before each scenario
        Given a running NATS stream "test_stream" with subject "test_subject"
        And a ClickHouse client with db "default" and table "events_test_dlq"

    Scenario: DLQ, publishing 4 messages, 4 should be in dlq, 0 in clickhouse
        Given the ClickHouse table "default.events_test_dlq" already exists with schema
            | column_name | data_type | constraint        |
            | event_id    | String    |                   |
            | name        | String    | length(name) <= 5 |
        And a stream consumer with config
            """json
            {
                "stream": "test_stream",
                "subject": "test_subject",
                "consumer": "test_consumer",
                "ack_wait": "1m"
            }
            """
        And a pipeline with configuration
            """json
            {
                "pipeline_id": "test-pipeline-dlq-1",
                "name": "test-pipeline-dlq-1",
                "source": {
                    "type": "kafka",
                    "topics": []
                },
                "sink": {
                    "type": "clickhouse",
                    "stream_id": "test_stream",
                    "source_id": "topic-1",
                    "batch": {
                        "max_batch_size": 4
                    },
                    "config": [
                        {
                            "source_field": "event_id",
                            "source_type": "string",
                            "destination_field": "event_id",
                            "destination_type": "UUID"
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
                    "topic-1": {
                        "source_id": "topic-1",
                        "version_id": "1",
                        "data_type": "json",
                        "fields": [
                            {
                                "name": "event_id",
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
        When I publish 4 events to the stream
            | event_id                             | name      | NATS-Schema-Version-Id |
            | c9e26b3f-b902-4fb4-91fd-87e6d5185a0c | Joe       | 1                      |
            | 123d97da-7e1f-4c81-b87b-23e741aa410a | Michael   | 1                      |
            | 5e76cfe8-3432-464b-9d85-272287df22e7 | Frank     | 1                      |
            | 5e76cfe8-3432-464b-9d85-272287df22e7 | Elizabeth | 1                      |
        And I run ClickHouse sink
        And Wait until all messages are processed
        And I gracefully stop ClickHouse sink
        Then the ClickHouse table "default.events_test_dlq" should contain 0 rows
        Then dlq should contain 4 events
